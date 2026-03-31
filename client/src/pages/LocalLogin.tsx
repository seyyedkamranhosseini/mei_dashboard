import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function LocalLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("admin@example.com");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Create a local session by calling the backend
      const response = await fetch("/api/trpc/auth.localLogin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      toast.success("Logged in successfully!");
      navigate("/");
    } catch (error) {
      toast.error("Login failed. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Inspection Dashboard</CardTitle>
          <CardDescription>Local Development Login</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500">
                For testing: use any email address. First login creates the account as admin.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>

            <div className="pt-4 border-t space-y-2">
              <p className="text-xs text-gray-600 font-medium">Test Accounts:</p>
              <button
                type="button"
                onClick={() => setEmail("admin@example.com")}
                className="w-full text-left text-xs p-2 hover:bg-gray-100 rounded"
              >
                👤 Admin: admin@example.com
              </button>
              <button
                type="button"
                onClick={() => setEmail("employee@example.com")}
                className="w-full text-left text-xs p-2 hover:bg-gray-100 rounded"
              >
                👥 Employee: employee@example.com
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
