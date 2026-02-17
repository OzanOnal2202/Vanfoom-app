import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'monteur' | 'admin' | 'foh';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isActive: boolean;
  isApproved: boolean;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isApproved, setIsApproved] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data) {
      setRole(data.role as AppRole);
    }
  };

  const fetchUserProfileStatus = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('is_active, is_approved')
      .eq('id', userId)
      .maybeSingle();
    
    if (data) {
      setIsActive(data.is_active ?? true);
      setIsApproved(data.is_approved ?? false);
    }
  };

  const logLogin = async (userId: string) => {
    try {
      await supabase.from('login_logs').insert({
        user_id: userId,
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error('Failed to log login:', error);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
            fetchUserProfileStatus(session.user.id);
          }, 0);
          
          // Log login event when user signs in
          if (event === 'SIGNED_IN') {
            setTimeout(() => logLogin(session.user.id), 0);
          }
        } else {
          setRole(null);
          setIsActive(true);
          setIsApproved(true);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      // Check if this was a session-only login that should be cleared
      const isSessionLogin = sessionStorage.getItem('vanfoom_session_login');
      const rememberMe = localStorage.getItem('vanfoom_remember_me');
      
      // If the browser was closed and reopened, sessionStorage will be empty
      // but if rememberMe was false, we should sign out
      if (session && rememberMe === 'false' && !isSessionLogin) {
        // Session login from previous browser session, sign out
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setRole(null);
        setIsActive(true);
        setIsApproved(true);
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
        fetchUserProfileStatus(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    // If rememberMe is false, we'll handle session expiry client-side
    // Supabase sessions are persistent by default, so we store the preference
    localStorage.setItem('vanfoom_remember_me', rememberMe ? 'true' : 'false');
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (!error && !rememberMe) {
      // If not remembering, set up session to expire when browser closes
      // by marking it as a session-only login
      sessionStorage.setItem('vanfoom_session_login', 'true');
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, isActive, isApproved, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
