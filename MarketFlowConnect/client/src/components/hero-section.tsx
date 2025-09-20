import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { useLocation } from "wouter";

export function HeroSection() {
  const [, setLocation] = useLocation();

  const handleGetLegacyPlan = () => {
    setLocation('/retirement');
  };

  const handleWatchStory = () => {
    // Open video modal or navigate to video page
    window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank');
  };

  return (
    <section className="hero-gradient text-white py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
              Protect Your Family.<br />
              <span className="text-secondary">Build Your Legacy.</span>
            </h1>
            <p className="text-xl lg:text-2xl mb-8 text-white/90">
              Personalized insurance & wealth solutions for today and tomorrow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button 
                size="lg" 
                onClick={handleGetLegacyPlan}
                className="bg-accent text-accent-foreground text-lg font-semibold hover:opacity-90"
                data-testid="button-free-legacy-plan"
              >
                Get My Free Legacy Plan
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                onClick={handleWatchStory}
                className="border-2 border-white text-white text-lg font-semibold bg-white/10 backdrop-blur-sm hover:bg-white hover:text-primary"
                data-testid="button-watch-story"
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Our Story
              </Button>
            </div>
          </div>
          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1511895426328-dc8714191300?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=600" 
              alt="Happy family at home" 
              className="rounded-xl shadow-2xl w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
