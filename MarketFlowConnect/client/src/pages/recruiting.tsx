import { useState } from "react";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DollarSign, GraduationCap, Clock, Heart, Rocket, ChevronDown } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertLead } from "@shared/schema";

export default function Recruiting() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    employmentStatus: "",
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
        description: "Your distributor starter kit is downloading now. Check your email for additional resources.",
      });
      
      // Trigger PDF download
      const link = document.createElement('a');
      link.href = '/api/pdf/distributor-kit';
      link.download = 'Distributor-Success-Starter-Kit.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setFormData({ name: "", email: "", phone: "", employmentStatus: "" });
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
      source: "recruiting",
      interests: ["distributor_opportunity", "financial_career"],
      employmentStatus: formData.employmentStatus,
    };

    submitLeadMutation.mutate(leadData);
  };

  const benefits = [
    {
      icon: <DollarSign className="h-6 w-6 text-white" />,
      title: "Unlimited Income Potential",
      description: "Earn based on your effort with no income ceiling"
    },
    {
      icon: <GraduationCap className="h-6 w-6 text-white" />,
      title: "Comprehensive Training",
      description: "Learn from industry experts with proven systems"
    },
    {
      icon: <Clock className="h-6 w-6 text-white" />,
      title: "Flexible Schedule",
      description: "Work from anywhere, set your own hours"
    },
    {
      icon: <Heart className="h-6 w-6 text-white" />,
      title: "Meaningful Impact",
      description: "Help families protect what matters most"
    }
  ];

  const faqs = [
    {
      question: "Do I need experience?",
      answer: "No prior experience needed. We provide complete training and ongoing support to help you succeed."
    },
    {
      question: "How much time is required?",
      answer: "Start part-time with just 10-15 hours per week. You can scale up as you build your business."
    },
    {
      question: "Is there an upfront cost?",
      answer: "Minimal startup costs with full support included. We believe in removing barriers to your success."
    }
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <section className="py-20 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">Turn Protection Into Prosperity</h1>
            <p className="text-xl text-white/90 max-w-3xl mx-auto">
              Join a team that protects families while creating lasting wealth. Build a meaningful career helping others secure their financial future.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-8">Why Join Fortune First?</h3>

              <div className="space-y-6 mb-8">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                      {benefit.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">{benefit.title}</h4>
                      <p className="text-white/80">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <img
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400"
                  alt="Diverse team collaboration"
                  className="rounded-xl shadow-lg w-full h-auto"
                />
              </div>
            </div>

            <div>
              <Card className="text-foreground shadow-xl">
                <CardContent className="p-8">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2 text-primary">Get Your Starter Kit</h3>
                    <p className="text-muted-foreground">
                      Download our Distributor Success Guide and learn how to get started
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      type="text"
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      data-testid="input-recruiting-name"
                    />
                    <Input
                      type="email"
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                      data-testid="input-recruiting-email"
                    />
                    <Input
                      type="tel"
                      placeholder="Phone Number"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      required
                      data-testid="input-recruiting-phone"
                    />
                    <Select
                      value={formData.employmentStatus}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, employmentStatus: value }))}
                      required
                    >
                      <SelectTrigger data-testid="select-employment-status">
                        <SelectValue placeholder="Current Employment Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employed">Currently Employed</SelectItem>
                        <SelectItem value="self-employed">Self-Employed</SelectItem>
                        <SelectItem value="unemployed">Looking for Work</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="submit"
                      className="w-full bg-accent text-accent-foreground font-semibold hover:opacity-90"
                      disabled={submitLeadMutation.isPending}
                      data-testid="button-get-starter-kit"
                    >
                      <Rocket className="mr-2 h-5 w-5" />
                      {submitLeadMutation.isPending ? "Submitting..." : "Get My Starter Kit"}
                    </Button>
                  </form>

                  <div className="mt-6">
                    <p className="text-sm text-muted-foreground mb-4 text-center">Common Questions Answered:</p>
                    <div className="space-y-2">
                      {faqs.map((faq, index) => (
                        <Collapsible key={index}>
                          <CollapsibleTrigger className="flex items-center justify-between w-full text-left text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                            <span>{faq.question}</span>
                            <ChevronDown className="h-4 w-4" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="text-sm text-muted-foreground mt-2">
                            {faq.answer}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
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
