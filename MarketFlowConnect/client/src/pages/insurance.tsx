import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Download, Lock } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertLead } from "@shared/schema";

export default function Insurance() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const { toast } = useToast();

  const submitLeadMutation = useMutation({
    mutationFn: async (leadData: InsertLead) => {
      const response = await apiRequest("POST", "/api/leads", leadData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your free insurance guide is downloading now. Check your email for additional resources.",
      });
      
      // Trigger PDF download
      const link = document.createElement('a');
      link.href = '/api/pdf/insurance-guide';
      link.download = 'Top-5-Life-Insurance-Strategies.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setFormData({ name: "", email: "", phone: "" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "There was an error submitting your information. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const leadData: InsertLead = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      source: "insurance",
      interests: ["life_insurance", "high_income_strategies"],
    };

    submitLeadMutation.mutate(leadData);
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold mb-6 text-primary">
                Secure Your Family's Future With Flexible Life Insurance
              </h1>
              <p className="text-xl mb-8 text-muted-foreground">
                Discover how you can grow wealth while protecting your loved ones with our comprehensive life insurance strategies.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-secondary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Flexible Premium Options</h3>
                    <p className="text-muted-foreground">Adjust your payments as your income changes</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-secondary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Cash Value Growth</h3>
                    <p className="text-muted-foreground">Build wealth that you can access during your lifetime</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-secondary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Tax Advantages</h3>
                    <p className="text-muted-foreground">Enjoy tax-deferred growth and tax-free death benefits</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Card className="shadow-lg">
                <CardContent className="p-8">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2">Free Insurance Guide</h3>
                    <p className="text-muted-foreground">Top 5 Life Insurance Strategies for High-Income Earners</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      type="text"
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      data-testid="input-insurance-name"
                    />
                    <Input
                      type="email"
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                      data-testid="input-insurance-email"
                    />
                    <Input
                      type="tel"
                      placeholder="Phone Number"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      required
                      data-testid="input-insurance-phone"
                    />
                    <Button
                      type="submit"
                      className="w-full bg-accent text-accent-foreground font-semibold hover:opacity-90"
                      disabled={submitLeadMutation.isPending}
                      data-testid="button-get-insurance-guide"
                    >
                      <Download className="mr-2 h-5 w-5" />
                      {submitLeadMutation.isPending ? "Submitting..." : "Get My Free Guide"}
                    </Button>
                  </form>

                  <div className="text-center mt-4 text-sm text-muted-foreground">
                    <Lock className="inline mr-1 h-4 w-4" />
                    Your information is secure and never shared
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
