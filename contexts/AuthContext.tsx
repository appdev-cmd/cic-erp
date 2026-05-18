import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase'; // Auth operations only
import { dataClient, syncAuthSession } from '../lib/dataClient'; // Data operations
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    isLoading: boolean;
    signOut: () => Promise<void>;

    // Permission helpers
    hasRole: (role: UserRole | UserRole[]) => boolean;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Dev bypass: ONLY on localhost + env flag. Never on production domains.
    const isDevBypass = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'
        && typeof window !== 'undefined'
        && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    useEffect(() => {
        if (isDevBypass) {
            console.log('[AuthContext] Dev bypass active – injecting mock Admin profile');
            // Use real Dev Admin UUID from profiles table so FK constraints work
            setProfile({
                id: '4fda6e7a-a8f7-4efd-a8cd-021a3e7e67c5',
                email: 'appdev@cic.com.vn',
                fullName: 'Dev Admin',
                role: 'Admin',
                unitId: 'all',
                avatarUrl: undefined,
                employeeId: '51bb76f8-5c7f-4413-835b-3f88bea13c9b' // TGĐ Nguyễn Hoàng Hà — for dev testing
            });
            
            const autoLogin = async () => {
                const devEmail = import.meta.env.VITE_DEV_EMAIL || 'appdev@cic.com.vn';
                const devPassword = import.meta.env.VITE_DEV_PASSWORD;
                
                if (devPassword) {
                    console.log('[AuthContext] Attempting silent dev auto-login...');
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: devEmail,
                        password: devPassword
                    });
                    
                    if (error) {
                        console.error('[AuthContext] Dev auto-login failed:', error.message);
                    } else {
                        console.log('[AuthContext] Dev auto-login successful');
                        syncAuthSession(data.session);
                        setSession(data.session);
                        setUser(data.user);
                        // Patch profile.id to real user UUID so DB queries (RLS) work,
                        // but keep role:'Admin' + unitId:'all' for full local access.
                        setProfile(prev => prev ? {
                            ...prev,
                            id: data.user.id,
                            email: data.user.email ?? prev.email,
                        } : prev);
                    }
                } else {
                    console.warn('[AuthContext] VITE_DEV_PASSWORD not set in .env.local. RLS may block database connections.');
                }
                
                setIsLoading(false);
            };
            
            autoLogin();
        }
    }, [isDevBypass]);

    useEffect(() => {
        let isMounted = true;
        console.log('[AuthContext] Starting auth initialization...');

        // Global safety timeout - shorter for faster fallback
        const safetyTimeout = setTimeout(() => {
            console.warn("[AuthContext] Safety timeout triggered - forcing release...");
            if (isMounted) setIsLoading(false);
        }, 5000); // Reduced to 5s

        // Initialize session
        console.log('[AuthContext] Calling getSession...');
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('[AuthContext] getSession result:', { hasSession: !!session, userId: session?.user?.id });
            if (!isMounted) return;

            setSession(session);
            setUser(session?.user ?? null);

            // Sync auth session to dataClient so DB triggers can identify the user
            syncAuthSession(session);

            // Persist Google provider_token for Google Sheets API access
            if (session?.provider_token) {
                sessionStorage.setItem('google_provider_token', session.provider_token);
                console.log('[AuthContext] Google provider_token saved (getSession)');
            }

            if (session?.user && !isDevBypass) {
                console.log('[AuthContext] User found, fetching profile...');
                fetchProfile(session.user.id, session.user.email);
            } else {
                console.log('[AuthContext] No session, setting loading false');
                clearTimeout(safetyTimeout);
                setIsLoading(false);
            }
        }).catch((err) => {
            console.error("[AuthContext] Session init error:", err);
            if (isMounted) {
                clearTimeout(safetyTimeout);
                setIsLoading(false);
            }
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log('[AuthContext] Auth state changed:', _event, { hasSession: !!session });
            if (!isMounted) return;

            setSession(session);
            setUser(session?.user ?? null);

            // Sync auth session to dataClient so DB triggers can identify the user
            syncAuthSession(session);

            // Persist Google provider_token for Google Sheets API access
            if (session?.provider_token) {
                sessionStorage.setItem('google_provider_token', session.provider_token);
                console.log('[AuthContext] Google provider_token saved to sessionStorage');
            }

            if (session?.user && !isDevBypass) {
                await fetchProfile(session.user.id, session.user.email);
            } else if (!isDevBypass) {
                setProfile(null);
                sessionStorage.removeItem('google_provider_token');
                setIsLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []);

    // ── Keep session alive: refresh on tab focus & periodic interval ──
    useEffect(() => {
        if (isDevBypass) return;

        // Refresh session when user returns to the tab after being away
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                console.log('[AuthContext] Tab visible again – refreshing session...');
                const { data, error } = await supabase.auth.refreshSession();
                if (error) {
                    console.warn('[AuthContext] Session refresh failed:', error.message);
                } else if (data.session) {
                    syncAuthSession(data.session);
                    console.log('[AuthContext] Session refreshed successfully');
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Periodic refresh every 3.5 hours (JWT default expiry = 1h, but Supabase auto-refreshes)
        // This is a safety net for long idle periods
        const refreshInterval = setInterval(async () => {
            console.log('[AuthContext] Periodic session refresh...');
            const { data, error } = await supabase.auth.refreshSession();
            if (!error && data.session) {
                syncAuthSession(data.session);
            }
        }, 3.5 * 60 * 60 * 1000); // 3.5 hours

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(refreshInterval);
        };
    }, [isDevBypass]);

    // NOTE: Presence management (online users tracking) has been extracted to PresenceContext.tsx
    // to prevent AuthContext re-renders when the online users list changes.

    const fetchProfile = async (userId: string, email?: string) => {
        console.log('[AuthContext.fetchProfile] Starting for userId:', userId);
        // Safety timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
            console.warn('[AuthContext.fetchProfile] Timeout - forcing loading false');
            setIsLoading(false);
        }, 3000); // Reduced to 3s

        try {
            // ===============================================
            // SECURITY: Email domain restriction (@cic.com.vn)
            // ===============================================
            if (email && !email.endsWith('@cic.com.vn')) {
                console.warn('[AuthContext.fetchProfile] REJECTED: Non-CIC email:', email);
                clearTimeout(timeoutId);
                alert('Chỉ tài khoản @cic.com.vn mới được phép đăng nhập vào hệ thống.');
                await supabase.auth.signOut();
                setSession(null);
                setUser(null);
                setProfile(null);
                setIsLoading(false);
                return;
            }

            console.log('[AuthContext.fetchProfile] Querying profiles table...');
            // Use dataClient for data operations (isolated from auth state)
            const { data: profiles, error } = await dataClient
                .from('profiles')
                .select('*')
                .eq('id', userId);

            console.log('[AuthContext.fetchProfile] Result:', { profiles, error });
            clearTimeout(timeoutId);

            if (error) {
                console.error("[AuthContext.fetchProfile] Error fetching profile:", error);
            } else if (profiles && profiles.length > 0) {
                const data = profiles[0];
                console.log('[AuthContext.fetchProfile] Raw data:', JSON.stringify(data));
                console.log('[AuthContext.fetchProfile] data.role:', data.role, 'typeof:', typeof data.role);

                // ===============================================
                // SECURITY: Verify employee exists in the system
                // Check employees table directly by email (not profile.employee_id)
                // This handles cases where profile was created before employee was added
                // ===============================================
                const SYSTEM_ROLES = ['Admin'];
                const isSystemRole = SYSTEM_ROLES.includes(data.role);
                const userEmail = email || data.email || '';

                let employeeId = data.employee_id;
                let unitId = data.unit_id;
                let userRole: UserRole = data.role as UserRole;
                let fullName = data.full_name;

                if (!isSystemRole) {
                    // Look up employee by email directly
                    const { data: empData, error: empError } = await dataClient
                        .from('employees')
                        .select('id, name, unit_id, role_code')
                        .ilike('email', userEmail)
                        .limit(1)
                        .single();

                    if (empError || !empData) {
                        console.warn('[AuthContext.fetchProfile] REJECTED: No employee found for email:', userEmail);
                        clearTimeout(timeoutId);
                        alert('Tài khoản của bạn chưa được đăng ký trong hệ thống nhân sự. Vui lòng liên hệ quản trị viên.');
                        await supabase.auth.signOut();
                        setSession(null);
                        setUser(null);
                        setProfile(null);
                        setIsLoading(false);
                        return;
                    }

                    // Employee found — auto-update profile if not linked yet
                    employeeId = empData.id;
                    unitId = empData.unit_id || unitId;
                    fullName = empData.name || fullName;
                    if (empData.role_code) userRole = empData.role_code as UserRole;

                    if (!data.employee_id || data.employee_id !== empData.id) {
                        console.log('[AuthContext.fetchProfile] Auto-linking profile to employee:', empData.id);
                        await dataClient
                            .from('profiles')
                            .update({
                                employee_id: empData.id,
                                unit_id: empData.unit_id,
                                full_name: empData.name,
                                role: empData.role_code || data.role,
                            })
                            .eq('id', userId);
                    }
                }

                // Look up unit code for permission checks
                let unitCode: string | undefined;
                if (unitId) {
                    const { data: unitData } = await dataClient
                        .from('units')
                        .select('code')
                        .eq('id', unitId)
                        .single();
                    unitCode = unitData?.code;
                }

                // ─── Sync Google avatar if profile has none ───
                let avatarUrl = data.avatar_url;
                if (!avatarUrl) {
                    // Try to get Google avatar from auth session metadata
                    const { data: { session: currentSession } } = await supabase.auth.getSession();
                    const googleAvatar = currentSession?.user?.user_metadata?.avatar_url
                        || currentSession?.user?.user_metadata?.picture;
                    if (googleAvatar) {
                        avatarUrl = googleAvatar;
                        // Save to profiles table for future use
                        await dataClient
                            .from('profiles')
                            .update({ avatar_url: googleAvatar })
                            .eq('id', userId);
                        console.log('[AuthContext.fetchProfile] Synced Google avatar to profile');
                    }
                }

                setProfile({
                    id: data.id,
                    email: userEmail,
                    fullName: fullName,
                    role: userRole,
                    unitId: unitId,
                    unitCode: unitCode,
                    avatarUrl: avatarUrl,
                    employeeId: employeeId
                });
                console.log('[AuthContext.fetchProfile] Profile set successfully');
            } else {
                // ===============================================
                // AUTO-CREATE PROFILE: If no profile exists, check
                // if an employee record with matching email exists.
                // If so, auto-create the profile so the user can log in.
                // ===============================================
                const userEmail = email || '';
                console.log('[AuthContext.fetchProfile] No profile found. Checking employees for email:', userEmail);

                if (userEmail) {
                    const { data: empData, error: empError } = await dataClient
                        .from('employees')
                        .select('id, name, email, unit_id, role_code')
                        .ilike('email', userEmail)
                        .limit(1)
                        .single();

                    if (!empError && empData) {
                        // Employee found — auto-create profile
                        console.log('[AuthContext.fetchProfile] Employee found! Auto-creating profile for:', empData.name);

                        const newProfile = {
                            id: userId,
                            email: empData.email || userEmail,
                            full_name: empData.name,
                            role: empData.role_code || 'NVKD',
                            employee_id: empData.id,
                            unit_id: empData.unit_id,
                        };

                        const { error: insertError } = await dataClient
                            .from('profiles')
                            .insert(newProfile);

                        if (insertError) {
                            console.error('[AuthContext.fetchProfile] Failed to auto-create profile:', insertError);
                            clearTimeout(timeoutId);
                            alert('Lỗi khi tạo hồ sơ người dùng. Vui lòng liên hệ quản trị viên.');
                            await supabase.auth.signOut();
                            setSession(null);
                            setUser(null);
                            setProfile(null);
                            setIsLoading(false);
                            return;
                        }

                        console.log('[AuthContext.fetchProfile] Profile auto-created successfully!');

                        // Look up unit code
                        let unitCode: string | undefined;
                        if (empData.unit_id) {
                            const { data: unitData } = await dataClient
                                .from('units')
                                .select('code')
                                .eq('id', empData.unit_id)
                                .single();
                            unitCode = unitData?.code;
                        }

                        setProfile({
                            id: userId,
                            email: empData.email || userEmail,
                            fullName: empData.name,
                            role: (empData.role_code || 'NVKD') as UserRole,
                            unitId: empData.unit_id,
                            unitCode: unitCode,
                            avatarUrl: undefined,
                            employeeId: empData.id,
                        });
                        console.log('[AuthContext.fetchProfile] Profile set successfully (auto-created)');
                    } else {
                        // No employee found either — reject
                        console.warn('[AuthContext.fetchProfile] REJECTED: No profile and no employee for:', userEmail);
                        clearTimeout(timeoutId);
                        alert('Tài khoản của bạn chưa được đăng ký trong hệ thống nhân sự. Vui lòng liên hệ quản trị viên.');
                        await supabase.auth.signOut();
                        setSession(null);
                        setUser(null);
                        setProfile(null);
                        setIsLoading(false);
                        return;
                    }
                } else {
                    console.warn('[AuthContext.fetchProfile] REJECTED: No profile and no email for user:', userId);
                    clearTimeout(timeoutId);
                    alert('Tài khoản của bạn chưa được đăng ký trong hệ thống. Vui lòng liên hệ quản trị viên.');
                    await supabase.auth.signOut();
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    setIsLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.error('[AuthContext.fetchProfile] Exception:', e);
        } finally {
            clearTimeout(timeoutId);
            console.log('[AuthContext.fetchProfile] Setting loading to false');
            setIsLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut({ scope: 'global' });
        setSession(null);
        setUser(null);
        setProfile(null);
    };

    // Helper to check permissions
    const hasRole = (role: UserRole | UserRole[]) => {
        if (!profile) return false;
        const roles = Array.isArray(role) ? role : [role];
        return roles.includes(profile.role);
    };

    const refreshProfile = async () => {
        if (!user) return;
        // Fetch profile kèm theo unit code để sidebar cập nhật ngay
        const { data: profiles } = await dataClient
            .from('profiles')
            .select('*, units(code)')
            .eq('id', user.id);
        if (profiles && profiles.length > 0) {
            const p = profiles[0];
            setProfile({
                id: p.id,
                email: p.email || user.email || '',
                fullName: p.full_name,
                role: p.role as UserRole,
                unitId: p.unit_id,
                unitCode: (p.units as any)?.code ?? undefined, // ← cập nhật unitCode
                avatarUrl: p.avatar_url,
                employeeId: p.employee_id
            });
        }
    };



    const value = {
        session,
        user,
        profile,
        isLoading,
        signOut,
        hasRole,
        refreshProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

/**
 * Get Google OAuth access token from sessionStorage.
 * Available after user signs in with Google (with spreadsheets scope).
 * Used to fetch private Google Sheets without requiring public sharing.
 */
export function getGoogleAccessToken(): string | null {
    return sessionStorage.getItem('google_provider_token');
}
