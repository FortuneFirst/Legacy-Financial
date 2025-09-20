import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertLead } from "@shared/schema";

interface QuizOption {
  label: string;
  description: string;
  value: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
}

const quizQuestions: QuizQuestion[] = [
  {
    id: "lifeStage",
    question: "What's your current life stage?",
    options: [
      { label: "Young Professional", description: "Starting career, building wealth", value: "young_professional" },
      { label: "Growing Family", description: "Married with children", value: "growing_family" },
      { label: "Peak Earner", description: "Established career, high income", value: "peak_earner" },
      { label: "Pre-Retirement", description: "Planning for retirement", value: "pre_retirement" },
    ],
  },
  {
    id: "financialGoal",
    question: "What's your primary financial goal?",
    options: [
      { label: "Protect Family Income", description: "Ensure income replacement", value: "protect_income" },
      { label: "Build Wealth", description: "Grow assets over time", value: "build_wealth" },
      { label: "Plan for Retirement", description: "Secure retirement income", value: "plan_retirement" },
      { label: "Leave a Legacy", description: "Pass wealth to heirs", value: "leave_legacy" },
    ],
  },
  {
    id: "currentCoverage",
    question: "How much life insurance coverage do you currently have?",
    options: [
      { label: "None", description: "No current coverage", value: "none" },
      { label: "Less than $100k", description: "Basic coverage", value: "under_100k" },
      { label: "$100k - $500k", description: "Moderate coverage", value: "100k_500k" },
      { label: "More than $500k", description: "Substantial coverage", value: "over_500k" },
    ],
  },
  {
    id: "annualIncome",
    question: "What's your annual household income?",
    options: [
      { label: "Under $50k", description: "Building financial foundation", value: "under_50k" },
      { label: "$50k - $100k", description: "Growing income bracket", value: "50k_100k" },
      { label: "$100k - $250k", description: "Higher income bracket", value: "100k_250k" },
      { label: "Over $250k", description: "High income earner", value: "over_250k" },
    ],
  },
];

export function InteractiveQuiz() {
  const [currentStep, setCurrentStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const { toast } = useToast();

  const submitQuizMutation = useMutation({
    mutationFn: async (leadData: InsertLead) => {
      const response = await apiRequest("POST", "/api/leads", leadData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your coverage guide is downloading now. Check your email for additional resources.",
      });
      
      // Trigger PDF download
      const link = document.createElement('a');
      link.href = '/api/pdf/insurance-guide';
      link.download = 'Top-5-Life-Insurance-Strategies.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Reset form
      setCurrentStep(0);
      setQuizAnswers({});
      setShowEmailCapture(false);
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

  const handleOptionSelect = (value: string) => {
    const currentQuestion = quizQuestions[currentStep];
    setQuizAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));

    setTimeout(() => {
      if (currentStep < quizQuestions.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        setShowEmailCapture(true);
      }
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const leadData: InsertLead = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      source: "quiz",
      interests: ["coverage_fit"],
      quizAnswers,
    };

    submitQuizMutation.mutate(leadData);
  };

  const progress = showEmailCapture ? 100 : ((currentStep + 1) / quizQuestions.length) * 100;

  if (showEmailCapture) {
    return (
      <section className="py-20 bg-muted">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="shadow-lg">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-4">Get Your Coverage Results</h3>
                <p className="text-muted-foreground">Enter your email to receive your coverage recommendations and free guide</p>
              </div>

              <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
                <Input
                  type="text"
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  data-testid="input-quiz-name"
                />
                <Input
                  type="email"
                  placeholder="Your Email Address"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  data-testid="input-quiz-email"
                />
                <Input
                  type="tel"
                  placeholder="Phone Number (Optional)"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  data-testid="input-quiz-phone"
                />
                <Button 
                  type="submit" 
                  className="w-full bg-accent text-accent-foreground font-semibold hover:opacity-90"
                  disabled={submitQuizMutation.isPending}
                  data-testid="button-get-coverage-guide"
                >
                  {submitQuizMutation.isPending ? "Submitting..." : "Get My Free Coverage Guide"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  const currentQuestion = quizQuestions[currentStep];

  return (
    <section className="py-20 bg-muted">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-primary">Find Your Coverage Fit in 2 Minutes</h2>
          <p className="text-lg text-muted-foreground">Answer a few questions to discover the protection plan that's right for your family</p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="mb-8">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Progress</span>
                <span data-testid="text-quiz-progress">Step {currentStep + 1} of {quizQuestions.length}</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div 
                  className="quiz-progress bg-secondary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                  data-testid="progress-quiz-bar"
                />
              </div>
            </div>

            <div className="fade-in">
              <h3 className="text-xl font-semibold mb-6">{currentQuestion.question}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    className="p-6 h-auto text-left justify-start hover:border-secondary hover:bg-secondary/5 transition-all"
                    onClick={() => handleOptionSelect(option.value)}
                    data-testid={`button-quiz-option-${option.value}`}
                  >
                    <div>
                      <div className="font-medium mb-2">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
