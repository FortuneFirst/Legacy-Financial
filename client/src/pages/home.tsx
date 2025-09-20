import { Navigation } from "@/components/navigation";
import { HeroSection } from "@/components/hero-section";
import { InteractiveQuiz } from "@/components/interactive-quiz";
import { TrustSection } from "@/components/trust-section";
import { TestimonialsCarousel } from "@/components/testimonials-carousel";
import { NewsletterSection } from "@/components/newsletter-section";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroSection />
      <InteractiveQuiz />
      <TrustSection />
      <TestimonialsCarousel />
      <NewsletterSection />
      <Footer />
    </div>
  );
}
