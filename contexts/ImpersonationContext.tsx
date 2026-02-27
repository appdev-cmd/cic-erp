import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, UserRole } from '../types';

const STORAGE_KEY = 'cic_erp_impersonation';

interface ImpersonationContextType {
    impersonatedUser: UserProfile | null;
    isImpersonating: boolean;
    startImpersonation: (user: UserProfile) => void;
    stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export const ImpersonationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initialize from localStorage if available
    const [impersonatedUser, setImpersonatedUser] = useState<UserProfile | null>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                console.log('[Impersonation] Restored from localStorage:', parsed.fullName, parsed.role);
                return parsed;
            }
        } catch (err) {
            console.warn('[Impersonation] Failed to restore from localStorage:', err);
            localStorage.removeItem(STORAGE_KEY);
        }
        return null;
    });

    const startImpersonation = (user: UserProfile) => {
        setImpersonatedUser(user);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        } catch (err) {
            console.warn('[Impersonation] Failed to save to localStorage:', err);
        }
        console.log('[Impersonation] Started as:', user.fullName, user.role);
    };

    const stopImpersonation = () => {
        console.log('[Impersonation] Stopped');
        setImpersonatedUser(null);
        localStorage.removeItem(STORAGE_KEY);
    };

    return (
        <ImpersonationContext.Provider
            value={{
                impersonatedUser,
                isImpersonating: !!impersonatedUser,
                startImpersonation,
                stopImpersonation,
            }}
        >
            {children}
        </ImpersonationContext.Provider>
    );
};

export const useImpersonation = () => {
    const context = useContext(ImpersonationContext);
    if (!context) {
        throw new Error('useImpersonation must be used within ImpersonationProvider');
    }
    return context;
};

/**
 * Hook to get effective profile (impersonated or real)
 * Use this instead of useAuth().profile when checking permissions
 */
export const useEffectiveProfile = () => {
    // Import useAuth inline to avoid circular dependency
    const { useAuth } = require('./AuthContext');
    const { profile: realProfile } = useAuth();
    const { impersonatedUser, isImpersonating } = useImpersonation();

    return {
        profile: isImpersonating ? impersonatedUser : realProfile,
        realProfile,
        isImpersonating,
    };
};
