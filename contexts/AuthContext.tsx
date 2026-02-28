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
    canEdit: (resource: 'contract' | 'pakd', resourceUnitId?: string, status?: string) => boolean;
    canApprove: (resource: 'pakd', curStatus: string) => boolean;
    refreshProfile: () => Promise<void>;
    onlineUsers: { id: string, fullName: string, avatarUrl?: string }[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<{ id: string, fullName: string, avatarUrl?: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Dev bypass: inject mock Admin profile when no real auth session
    const isDevBypass = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

    useEffect(() => {
        if (isDevBypass) {
            console.log('[AuthContext] Dev bypass active – injecting mock Admin profile');
            setProfile({
                id: 'dev-admin-000',
                email: 'dev@localhost',
                fullName: 'Dev Admin',
                role: 'Admin',
                unitId: 'all',
                avatarUrl: undefined,
                employeeId: undefined
            });
            setIsLoading(false);
            // Still try to get real session below so Google-token etc. work if available
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

    // Presence Management
    useEffect(() => {
        // In dev bypass, we might not have a Supabase user, but we have a profile
        const userId = user?.id || (isDevBypass ? profile?.id : null);
        if (!userId || !profile) return;

        console.log('[AuthContext] Initializing presence for user:', userId);

        const channel = supabase.channel('online_users', {
            config: {
                presence: {
                    key: userId,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                console.log('[AuthContext] Presence Sync State:', state);

                const users: any[] = [];
                Object.keys(state).forEach((key) => {
                    const presence = state[key][0] as any;
                    if (presence.user_info) {
                        users.push({
                            id: key,
                            ...presence.user_info
                        });
                    }
                });
                setOnlineUsers(users);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('[AuthContext] User joined:', key, newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('[AuthContext] User left:', key, leftPresences);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[AuthContext] Subscribed to presence channel');
                    await channel.track({
                        user_info: {
                            fullName: profile.fullName,
                            avatarUrl: profile.avatarUrl,
                        },
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            console.log('[AuthContext] Unsubscribing from presence');
            channel.unsubscribe();
        };
    }, [user, profile]);

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

                setProfile({
                    id: data.id,
                    email: userEmail,
                    fullName: fullName,
                    role: userRole,
                    unitId: unitId,
                    unitCode: unitCode,
                    avatarUrl: data.avatar_url,
                    employeeId: employeeId
                });
                console.log('[AuthContext.fetchProfile] Profile set successfully');
            } else {
                // ===============================================
                // SECURITY: Profile must exist in the system
                // ===============================================
                console.warn('[AuthContext.fetchProfile] REJECTED: No profile found for user:', userId, email);
                alert('Tài khoản của bạn chưa được đăng ký trong hệ thống. Vui lòng liên hệ quản trị viên.');
                await supabase.auth.signOut();
                setSession(null);
                setUser(null);
                setProfile(null);
                setIsLoading(false);
                return;
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
        await supabase.auth.signOut();
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

    const canEdit = (resource: 'contract' | 'pakd', resourceUnitId?: string, status?: string) => {
        if (!profile) return false;
        // Admin role (from database) has full access
        if (profile.role === 'Admin' || profile.role === 'Leadership') return true;

        // If no status is passed, assume editable unless specific restrictions apply based on role/unit
        if (!status) return true;

        // Most resources are editable only in Draft or early stages
        // Contracts typically editable until signed/active, but here we simplify
        if (['Draft', 'New', 'Processing'].includes(status)) {
            // If resourceUnitId provided, check if user belongs to that unit or is global
            if (resourceUnitId && profile.unitId) {
                if (profile.unitId === 'all') return true;
                if (resourceUnitId !== profile.unitId) return false;
            }
            return true;
        }

        // Once approved/active, editing is restricted
        return false;
    };

    const canApprove = (resource: 'pakd', curStatus: string) => {
        if (!profile) return false;
        // Admin/Leadership role (from database) has full access
        if (profile.role === 'Admin' || profile.role === 'Leadership') return true;

        switch (curStatus) {
            case 'Pending_Unit':
                return profile.role === 'UnitLeader' || profile.role === 'AdminUnit';
            case 'Pending_Finance':
                return profile.role === 'Accountant' || profile.role === 'ChiefAccountant';
            case 'Pending_Board':
                return false; // Already handled by early return if it was Leadership
            default:
                return false;
        }
    };

    const refreshProfile = async () => {
        if (!user) return;
        // Use dataClient for data operations
        const { data: profiles } = await dataClient.from('profiles').select('*').eq('id', user.id);
        if (profiles && profiles.length > 0) {
            setProfile({
                id: profiles[0].id,
                email: profiles[0].email || user.email || '',
                fullName: profiles[0].full_name,
                role: profiles[0].role as UserRole,
                unitId: profiles[0].unit_id,
                avatarUrl: profiles[0].avatar_url,
                employeeId: profiles[0].employee_id
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
        canEdit,
        canApprove,
        refreshProfile,
        onlineUsers
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
