import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    setLocation('/insurance');
  };

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/" className="text-2xl font-bold text-primary">
                Fortune First
              </Link>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <Link href="/insurance" className="text-foreground hover:text-primary transition-colors">
              Insurance
            </Link>
            <Link href="/retirement" className="text-foreground hover:text-primary transition-colors">
              Retirement
            </Link>
            <Link href="/recruiting" className="text-foreground hover:text-primary transition-colors">
              Opportunities
            </Link>
            <Button 
              onClick={handleGetStarted}
              className="bg-accent text-accent-foreground hover:opacity-90" 
              data-testid="button-get-started"
            >
              Get Started
            </Button>
          </div>
          
          <div className="md:hidden">
            <Button
              variant="ghost"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
        
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 space-y-4">
            <Link href="/" className="block text-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <Link href="/insurance" className="block text-foreground hover:text-primary transition-colors">
              Insurance
            </Link>
            <Link href="/retirement" className="block text-foreground hover:text-primary transition-colors">
              Retirement
            </Link>
            <Link href="/recruiting" className="block text-foreground hover:text-primary transition-colors">
              Opportunities
            </Link>
            <Button 
              onClick={handleGetStarted}
              className="w-full bg-accent text-accent-foreground hover:opacity-90" 
              data-testid="button-mobile-get-started"
            >
              Get Started
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
