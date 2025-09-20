import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Calendar } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertLead } from "@shared/schema";

export default function Retirement() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
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
        description: "Your retirement checklist is downloading now. Check your email for additional resources.",
      });
      
      // Trigger PDF download
      const link = document.createElement('a');
      link.href = '/api/pdf/retirement-checklist';
      link.download = 'Retirement-Security-Checklist.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setFormData({ name: "", email: "" });
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
      source: "retirement",
      interests: ["retirement_planning", "retirement_security"],
    };

    submitLeadMutation.mutate(leadData);
  };

  const handleBookConsultation = () => {
    toast({
      title: "Calendar Integration",
      description: "Calendar booking widget would open here. Please call us to schedule your consultation.",
    });
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <section className="py-20 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold mb-6 text-primary">
              Will Your Retirement Income Last?
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Let's find out together. Our comprehensive retirement planning ensures you can maintain your lifestyle and leave a lasting legacy.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <img
                src="https://images.unsplash.com/photo-1559526324-593bc073d938?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=600"
                alt="Couple planning retirement"
                className="rounded-xl shadow-lg w-full h-auto"
              />
            </div>

            <div className="space-y-8">
              <Card className="shadow-lg">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-4 text-center">Free Retirement Security Checklist</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Download our comprehensive checklist to evaluate your retirement readiness
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      type="text"
                      placeholder="Your Name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      data-testid="input-retirement-name"
                    />
                    <Input
                      type="email"
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                      data-testid="input-retirement-email"
                    />
                    <Button
                      type="submit"
                      className="w-full bg-secondary text-secondary-foreground font-semibold hover:opacity-90"
                      disabled={submitLeadMutation.isPending}
                      data-testid="button-get-retirement-checklist"
                    >
                      <Download className="mr-2 h-5 w-5" />
                      {submitLeadMutation.isPending ? "Submitting..." : "Get My Free Checklist"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardContent className="p-8">
                  <h3 className="text-xl font-bold mb-4 text-center">Schedule a 15-Minute Consultation</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Speak with a retirement planning expert about your specific situation
                  </p>

                  <div className="text-center">
                    <Button
                      onClick={handleBookConsultation}
                      className="bg-accent text-accent-foreground px-6 py-3 font-semibold hover:opacity-90"
                      data-testid="button-book-consultation"
                    >
                      <Calendar className="mr-2 h-5 w-5" />
                      Book Free Consultation
                    </Button>
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
