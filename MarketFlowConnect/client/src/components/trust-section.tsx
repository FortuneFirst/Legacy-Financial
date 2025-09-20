import { Shield, Users, Award, Lock, Handshake, Star } from "lucide-react";

export function TrustSection() {
  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Why Families Trust Fortune First</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our commitment to your financial security is backed by experience, expertise, and results.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2" data-testid="text-years-experience">15+ Years</h3>
            <p className="text-muted-foreground">Of protecting families and building wealth</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2" data-testid="text-families-served">500+</h3>
            <p className="text-muted-foreground">Families served across the country</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2" data-testid="text-licensed-advisors">Licensed</h3>
            <p className="text-muted-foreground">Certified financial advisors you can trust</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
          <div className="text-center">
            <Award className="h-8 w-8 text-primary mb-2 mx-auto" />
            <div className="text-sm font-medium">A+ BBB Rating</div>
          </div>
          <div className="text-center">
            <Lock className="h-8 w-8 text-primary mb-2 mx-auto" />
            <div className="text-sm font-medium">FINRA Licensed</div>
          </div>
          <div className="text-center">
            <Handshake className="h-8 w-8 text-primary mb-2 mx-auto" />
            <div className="text-sm font-medium">NAIFA Member</div>
          </div>
          <div className="text-center">
            <Star className="h-8 w-8 text-primary mb-2 mx-auto" />
            <div className="text-sm font-medium">5-Star Reviews</div>
          </div>
        </div>
      </div>
    </section>
  );
}
