import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "@/lib/api";
import type { LoginRequest, RegisterRequest, User } from "@/lib/types";

interface AuthContextType {
    user: User | null;
    /** True until the stored session has been checked on first load. */
    isRestoring: boolean;
    login: (body: LoginRequest) => Promise<User>;
    register: (body: RegisterRequest) => Promise<User>;
    logout: () => void;
    /** Replace the cached user after a profile change. */
    setUser: (user: User) => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isRestoring, setIsRestoring] = useState(() => Boolean(tokenStore.get()));

    const logout = useCallback(() => {
        tokenStore.clear();
        setUser(null);
    }, []);

    useEffect(() => {
        setUnauthorizedHandler(logout);
    }, [logout]);

    useEffect(() => {
        if (!tokenStore.get()) return;
        api.auth
            .me()
            .then(setUser)
            .catch(() => tokenStore.clear())
            .finally(() => setIsRestoring(false));
    }, []);

    const login = useCallback(async (body: LoginRequest) => {
        const response = await api.auth.login(body);
        tokenStore.set(response.token);
        setUser(response.user);
        return response.user;
    }, []);

    const register = useCallback(async (body: RegisterRequest) => {
        const response = await api.auth.register(body);
        tokenStore.set(response.token);
        setUser(response.user);
        return response.user;
    }, []);

    const refreshUser = useCallback(async () => {
        setUser(await api.auth.me());
    }, []);

    const value = useMemo(
        () => ({ user, isRestoring, login, register, logout, setUser, refreshUser }),
        [user, isRestoring, login, register, logout, refreshUser],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
