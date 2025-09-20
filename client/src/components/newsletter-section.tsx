import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertNewsletter } from "@shared/schema";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const subscribeMutation = useMutation({
    mutationFn: async (data: InsertNewsletter) => {
      const response = await apiRequest("POST", "/api/newsletter", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Thank you for subscribing! Check your email for confirmation.",
      });
      setEmail("");
    },
    onError: (error: any) => {
      const errorMessage = error.message.includes("already subscribed") 
        ? "You're already subscribed to our newsletter!"
        : "There was an error subscribing. Please try again.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    subscribeMutation.mutate({ email });
  };

  return (
    <section className="py-16 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold mb-4">Weekly Wealth Tips in Your Inbox</h2>
        <p className="text-lg text-muted-foreground mb-8">
          Stay informed with expert insights on insurance, investments, and financial planning delivered every Tuesday.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row max-w-md mx-auto gap-4">
          <Input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
            required
            data-testid="input-newsletter-email"
          />
          <Button
            type="submit"
            className="bg-primary text-primary-foreground hover:opacity-90 whitespace-nowrap"
            disabled={subscribeMutation.isPending}
            data-testid="button-newsletter-subscribe"
          >
            {subscribeMutation.isPending ? "Subscribing..." : "Subscribe Free"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-4">Join 2,500+ subscribers. Unsubscribe anytime.</p>
      </div>
    </section>
  );
}
