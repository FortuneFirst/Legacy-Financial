import { Link } from "wouter";
import { Facebook, Linkedin, Twitter, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-primary text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="mb-4">
              <span className="text-2xl font-bold">Fortune First</span>
            </div>
            <p className="text-white/80 mb-6 max-w-md">
              Protecting families and building wealth for over 15 years. Your trusted partner in financial security and growth.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-white/60 hover:text-white transition-colors" data-testid="link-social-facebook">
                <Facebook className="h-6 w-6" />
              </a>
              <a href="#" className="text-white/60 hover:text-white transition-colors" data-testid="link-social-linkedin">
                <Linkedin className="h-6 w-6" />
              </a>
              <a href="#" className="text-white/60 hover:text-white transition-colors" data-testid="link-social-twitter">
                <Twitter className="h-6 w-6" />
              </a>
              <a href="#" className="text-white/60 hover:text-white transition-colors" data-testid="link-social-youtube">
                <Youtube className="h-6 w-6" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Services</h3>
            <ul className="space-y-2 text-white/80">
              <li><Link href="/insurance" className="hover:text-white transition-colors">Life Insurance</Link></li>
              <li><Link href="/retirement" className="hover:text-white transition-colors">Retirement Planning</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">Wealth Management</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Estate Planning</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-white/80">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Our Team</a></li>
              <li><Link href="/recruiting" className="hover:text-white transition-colors">Careers</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/20 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-white/60 text-sm">© 2024 Fortune First. All rights reserved.</p>
          <div className="flex space-x-6 text-sm text-white/60 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Licenses</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
