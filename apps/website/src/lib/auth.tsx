// Auth wrapper that uses WorkOS AuthKit
// This provides a consistent interface for components while using AuthKit under the hood

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth as useAuthKit } from "@workos-inc/authkit-react";
import { useConvexAuth } from "convex/react";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: () => void;
  signOut: () => void;
}

// Main auth hook that wraps AuthKit
export function useAuth(): AuthState {
  const { user, signIn, signOut, isLoading: authKitLoading, getAccessToken } = useAuthKit();
  const { isLoading: convexLoading, isAuthenticated: convexAuthenticated } = useConvexAuth();

  // Track token refresh attempts
  const refreshAttempts = useRef(0);
  const maxRefreshAttempts = 3;
  const [isSyncing, setIsSyncing] = useState(false);

  // Map WorkOS user to our User interface
  const mappedUser: User | null = user
    ? {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        profilePictureUrl: user.profilePictureUrl ?? undefined,
      }
    : null;

  // Determine base loading state
  const isBaseLoading = authKitLoading || convexLoading;

  // WorkOS has a user session
  const hasWorkosSession = !!user;

  // Refresh token when WorkOS has session but Convex doesn't
  const refreshToken = useCallback(async () => {
    if (!getAccessToken || refreshAttempts.current >= maxRefreshAttempts) {
      setIsSyncing(false);
      return;
    }

    refreshAttempts.current += 1;
    setIsSyncing(true);

    try {
      await getAccessToken();
      // Give Convex a moment to process the new token
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {
      // Token refresh failed - will retry or give up
    }

    setIsSyncing(false);
  }, [getAccessToken]);

  // If WorkOS has session but Convex doesn't, try to refresh token
  useEffect(() => {
    if (
      hasWorkosSession &&
      !convexAuthenticated &&
      !isBaseLoading &&
      !isSyncing &&
      refreshAttempts.current < maxRefreshAttempts
    ) {
      refreshToken();
    }

    // Reset attempts when user signs out
    if (!hasWorkosSession) {
      refreshAttempts.current = 0;
    }
  }, [hasWorkosSession, convexAuthenticated, isBaseLoading, isSyncing, refreshToken]);

  // Reset attempts when successfully authenticated
  useEffect(() => {
    if (convexAuthenticated) {
      refreshAttempts.current = 0;
    }
  }, [convexAuthenticated]);

  // Use Convex auth state as source of truth
  const isAuthenticated = convexAuthenticated;

  // Show loading while syncing (but with timeout protection via maxRefreshAttempts)
  const isLoading = isBaseLoading || (isSyncing && hasWorkosSession);

  return {
    user: mappedUser,
    isLoading,
    isAuthenticated,
    signIn: () => signIn(),
    signOut: () => signOut(),
  };
}

// Compatibility export for useAuthState
export function useAuthState() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  return { isLoading, isAuthenticated };
}
