import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

const testimonials = [
  {
    id: 1,
    name: "Sarah Johnson",
    location: "Mother of 2, Denver",
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b5bc?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
    text: "Fortune First helped us navigate the complex world of life insurance with such patience and expertise. We now have peace of mind knowing our children's future is secure.",
  },
  {
    id: 2,
    name: "Michael Chen",
    location: "Retired Engineer, Austin",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
    text: "The retirement planning service exceeded our expectations. We're now confident we can maintain our lifestyle throughout retirement and leave something for our grandchildren.",
  },
  {
    id: 3,
    name: "Amanda Rodriguez",
    location: "Team Member, Phoenix",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
    text: "Joining the Fortune First team was the best decision I made for my family's financial future. The support and training are incredible, and I'm helping other families too.",
  },
];

export function TestimonialsCarousel() {
  return (
    <section className="py-20 bg-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">What Our Clients Say</h2>
          <p className="text-lg text-muted-foreground">Real stories from families we've helped secure their future</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="testimonial-card shadow-lg">
              <CardContent className="p-8">
                <div className="mb-6">
                  <div className="flex text-accent text-lg mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-current" />
                    ))}
                  </div>
                  <p className="text-muted-foreground italic" data-testid={`text-testimonial-${testimonial.id}`}>
                    "{testimonial.text}"
                  </p>
                </div>
                <div className="flex items-center">
                  <img
                    src={testimonial.image}
                    alt={`${testimonial.name} testimonial`}
                    className="w-12 h-12 rounded-full mr-4"
                    data-testid={`img-testimonial-${testimonial.id}`}
                  />
                  <div>
                    <div className="font-semibold" data-testid={`text-testimonial-name-${testimonial.id}`}>
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-muted-foreground" data-testid={`text-testimonial-location-${testimonial.id}`}>
                      {testimonial.location}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
