import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Leaf } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

export default function AuthPage() {
    const { user, loginMutation } = useAuth();
    const [, setLocation] = useLocation();

    // Carousel setup with autoplay
    const [emblaRef] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000 })]);

    const slides = [
        {
            image: "/assets/slide_1.png",
            quote: "Fresh from the farm to your business.",
            author: "Premium Quality"
        },
        {
            image: "/assets/slide_2.png",
            quote: "Organized inventory management for efficiency.",
            author: "Smart Operations"
        },
        {
            image: "/assets/slide_3.png",
            quote: "Streamline your daily wholesale transactions.",
            author: "Business Growth"
        }
    ];

    useEffect(() => {
        if (user) {
            setLocation("/");
        }
    }, [user, setLocation]);

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* Left Side - Login Form */}
            <div
                className="flex items-center justify-center p-8 relative"
                style={{
                    backgroundImage: `url('/assets/login_bg.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                {/* Overlay for readability */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0"></div>

                <Card className="w-full max-w-md border-0 shadow-2xl z-10 bg-white/95 text-foreground backdrop-blur-md">
                    <CardHeader className="space-y-1 text-center">
                        <div className="flex justify-center mb-4">
                            <div className="bg-primary/20 p-3 rounded-full">
                                <Leaf className="h-8 w-8 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-primary">PSK Vegetables</h1>
                        <p className="text-sm text-muted-foreground font-medium">Wholesale Management System</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="mb-6 text-center">
                            <h2 className="text-xl font-semibold">Welcome Back!</h2>
                            <p className="text-muted-foreground text-sm">Please sign in to continue</p>
                        </div>
                        <LoginForm />
                    </CardContent>
                </Card>
            </div>

            {/* Right Side - Carousel Slideshow */}
            <div className="hidden lg:flex flex-col bg-muted relative overflow-hidden text-white">
                <div className="absolute inset-0 z-0 bg-black/60" /> {/* Dark overlay for text readability */}

                <div className="flex-1 relative z-10" ref={emblaRef}>
                    <div className="flex h-full touch-pan-y">
                        {slides.map((slide, index) => (
                            <div className="flex-[0_0_100%] min-w-0 relative" key={index}>
                                <div
                                    className="absolute inset-0 z-[-1]"
                                    style={{
                                        backgroundImage: `url('${slide.image}')`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                />
                                <div className="h-full w-full flex flex-col justify-end p-12 pb-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                                    <blockquote className="space-y-4 max-w-lg">
                                        <p className="text-3xl font-medium leading-normal">
                                            "{slide.quote}"
                                        </p>
                                        <footer className="text-lg text-white/80 font-medium">
                                            &mdash; {slide.author}
                                        </footer>
                                    </blockquote>
                                </div>
                            </div>
                        ))}
                    </div>
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
                                <Input placeholder="Enter username" {...field} className="bg-background/50" />
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
                                <Input type="password" placeholder="Enter password" {...field} className="bg-background/50" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full h-11 text-base font-semibold shadow-md mt-2" disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
            </form>
        </Form>
    );
}


