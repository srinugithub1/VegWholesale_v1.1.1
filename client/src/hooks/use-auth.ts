import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type User, type InsertUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    // Uses fetch directly rather than apiRequest so a 401 can be told apart from
    // a transient failure. Only a real 401 means "logged out" - anything else
    // (500, DB stall, dropped connection) throws, and React Query keeps the
    // last known user instead of nulling it and bouncing us to the login page.
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) {
        throw new Error(`${res.status}: ${(await res.text()) || res.statusText}`);
      }
      return await res.json();
    },
    retry: false,
    staleTime: Infinity,
    // Override the global 30s refetchInterval. Polling this often only served to
    // multiply the chances of a transient failure; 5 minutes is still frequent
    // enough to notice a genuinely expired session.
    refetchInterval: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: Pick<InsertUser, "username" | "password">) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({ title: "Welcome back!", description: `Logged in as ${user.firstName || user.username}` });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({ title: "Account created", description: "Welcome to VegWholesale!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({ title: "Logged out", description: "See you next time!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    user: user ?? null,
    isLoading,
    error,
    loginMutation,
    registerMutation,
    logoutMutation,
  };
}
