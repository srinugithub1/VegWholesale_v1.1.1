import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Truck } from "lucide-react";

export default function AuthPage() {
    const { user, loginMutation } = useAuth();
    const [, setLocation] = useLocation();

    useEffect(() => {
        if (user) {
            setLocation("/");
        }
    }, [user, setLocation]);

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            <div className="flex items-center justify-center p-8 bg-background">
                <Card className="w-full max-w-md border-border/50 shadow-xl">
                    <CardHeader className="space-y-1">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-primary/10 p-2 rounded-full">
                                <Truck className="h-6 w-6 text-primary" />
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">VegWholesale</h1>
                        </div>
                        <CardTitle className="text-2xl">Welcome back</CardTitle>
                        <CardDescription>
                            Sign in to your account to get started.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <LoginForm />
                    </CardContent>
                </Card>
            </div>
            <div className="hidden lg:flex flex-col justify-center p-12 bg-primary/5 border-l border-border/50">
                <div className="max-w-md mx-auto space-y-4">
                    <blockquote className="space-y-2">
                        <p className="text-lg font-medium leading-relaxed">
                            "Streamline your vegetable wholesale operations efficiently. Manage inventory, sales, and accounts all in one place."
                        </p>
                    </blockquote>
                </div>
            </div>
        </div>
    );
}

function LoginForm() {
    const { loginMutation } = useAuth();
    const form = useForm({
        resolver: zodResolver(insertUserSchema.pick({ username: true, password: true })),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter your username" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input type="password" placeholder="Enter your password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
            </form>
        </Form>
    );
}


