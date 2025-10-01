import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <nav className="max-w-6xl mx-auto flex justify-between items-center px-8 py-4">
          <a href="/" className="flex items-center gap-2 text-2xl font-bold text-indigo-600 no-underline">
            <i className="fas fa-graduation-cap"></i>
            SecureExam
          </a>
          
          {/* Desktop Navigation */}
          <ul className="hidden md:flex items-center gap-8 list-none">
            <li><a href="#" className="text-slate-600 font-medium hover:text-indigo-600 transition-colors no-underline">Home</a></li>
            <li><a href="#features" className="text-slate-600 font-medium hover:text-indigo-600 transition-colors no-underline">Features</a></li>
            <li><a href="#stats" className="text-slate-600 font-medium hover:text-indigo-600 transition-colors no-underline">About</a></li>
            <li><a href="#contact" className="text-slate-600 font-medium hover:text-indigo-600 transition-colors no-underline">Contact</a></li>
            <li>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = "/admin/login"}
                className="border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white"
                data-testid="button-admin-login"
              >
                Admin
              </Button>
            </li>
            <li>
              <Button 
                onClick={() => window.location.href = "/student/auth"}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="button-student-login"
              >
                Student Login
              </Button>
            </li>
          </ul>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-slate-600 text-xl"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            <i className="fas fa-bars"></i>
          </button>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 px-4 py-4">
            <div className="flex flex-col gap-4">
              <a href="#" className="text-slate-600 font-medium hover:text-indigo-600 transition-colors no-underline">Home</a>
              <a href="#features" className="text-slate-600 font-medium hover:text-indigo-600 transition-colors no-underline">Features</a>
              <a href="#stats" className="text-slate-600 font-medium hover:text-indigo-600 transition-colors no-underline">About</a>
              <a href="#contact" className="text-slate-600 font-medium hover:text-indigo-600 transition-colors no-underline">Contact</a>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = "/admin/login"}
                  className="border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white flex-1"
                >
                  Admin
                </Button>
                <Button 
                  onClick={() => window.location.href = "/student/auth"}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1"
                >
                  Student Login
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white py-24 text-center">
        <div className="max-w-4xl mx-auto px-8">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Secure Online Examinations
          </h1>
          <p className="text-xl mb-8 opacity-90 max-w-3xl mx-auto">
            Advanced AI-powered proctoring system ensuring exam integrity with real-time monitoring and anti-cheating technology
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => window.location.href = "/student/auth"}
              className="bg-white text-indigo-600 hover:bg-gray-100 px-8 py-3 text-lg"
              data-testid="button-start-exam"
            >
              <i className="fas fa-sign-in-alt mr-2"></i>
              Start Exam
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="border-white text-white hover:bg-white hover:text-indigo-600 px-8 py-3 text-lg"
              data-testid="button-watch-demo"
            >
              <i className="fas fa-play mr-2"></i>
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-800 mb-4">
              Why Choose SecureExam?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Comprehensive examination platform with cutting-edge security features
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: "fas fa-video",
                title: "Live Proctoring",
                description: "AI-powered real-time monitoring with facial recognition and behavior analysis to detect suspicious activities"
              },
              {
                icon: "fas fa-shield-alt",
                title: "Anti-Cheating Technology",
                description: "Advanced browser lockdown, tab switching detection, and copy-paste prevention mechanisms"
              },
              {
                icon: "fas fa-qrcode",
                title: "Digital Verification",
                description: "Hall ticket scanning, biometric authentication, and secure student identity verification"
              },
              {
                icon: "fas fa-chart-line",
                title: "Analytics Dashboard",
                description: "Comprehensive reporting with exam analytics, performance metrics, and security incident tracking"
              },
              {
                icon: "fas fa-mobile-alt",
                title: "Multi-Device Support",
                description: "Seamless experience across desktop, tablet, and mobile devices with responsive design"
              },
              {
                icon: "fas fa-cloud",
                title: "Cloud Infrastructure",
                description: "Scalable cloud-based platform ensuring 99.9% uptime and secure data storage"
              }
            ].map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-xl flex items-center justify-center text-2xl mb-6">
                    <i className={feature.icon}></i>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="bg-slate-800 text-white py-16">
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { number: "50K+", label: "Students Examined" },
              { number: "500+", label: "Educational Institutes" },
              { number: "99.9%", label: "Uptime Guaranteed" },
              { number: "24/7", label: "Technical Support" }
            ].map((stat, index) => (
              <div key={index}>
                <h3 className="text-4xl font-bold text-cyan-400 mb-2">
                  {stat.number}
                </h3>
                <p className="text-lg opacity-90">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white py-24 text-center">
        <div className="max-w-4xl mx-auto px-8">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Secure Your Exams?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Join thousands of educational institutions using SecureExam for fraud-free examinations
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => window.location.href = "/student/auth"}
              className="bg-white text-indigo-600 hover:bg-gray-100 px-8 py-3 text-lg"
              data-testid="button-get-started"
            >
              <i className="fas fa-rocket mr-2"></i>
              Get Started Now
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.href = "/admin/login"}
              className="border-white text-white hover:bg-white hover:text-indigo-600 px-8 py-3 text-lg"
              data-testid="button-contact-sales"
            >
              <i className="fas fa-phone mr-2"></i>
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-semibold mb-4">SecureExam</h3>
              <p className="text-slate-300 mb-4">
                Leading online examination platform with advanced security and proctoring features.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-slate-300 hover:text-white text-xl"><i className="fab fa-facebook"></i></a>
                <a href="#" className="text-slate-300 hover:text-white text-xl"><i className="fab fa-twitter"></i></a>
                <a href="#" className="text-slate-300 hover:text-white text-xl"><i className="fab fa-linkedin"></i></a>
                <a href="#" className="text-slate-300 hover:text-white text-xl"><i className="fab fa-youtube"></i></a>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Platform</h3>
              <ul className="space-y-2">
                <li><a href="/student/auth" className="text-slate-300 hover:text-white no-underline">Student Login</a></li>
                <li><a href="/admin/login" className="text-slate-300 hover:text-white no-underline">Admin Panel</a></li>
                <li><a href="#features" className="text-slate-300 hover:text-white no-underline">Features</a></li>
                <li><a href="#stats" className="text-slate-300 hover:text-white no-underline">About</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-300 hover:text-white no-underline">Documentation</a></li>
                <li><a href="#" className="text-slate-300 hover:text-white no-underline">API Reference</a></li>
                <li><a href="#" className="text-slate-300 hover:text-white no-underline">System Requirements</a></li>
                <li><a href="#" className="text-slate-300 hover:text-white no-underline">Security Guide</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Support</h3>
              <ul className="space-y-2">
                <li><a href="#contact" className="text-slate-300 hover:text-white no-underline">Contact Us</a></li>
                <li><a href="#" className="text-slate-300 hover:text-white no-underline">Help Center</a></li>
                <li><a href="#" className="text-slate-300 hover:text-white no-underline">Technical Support</a></li>
                <li><a href="#" className="text-slate-300 hover:text-white no-underline">System Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-8 text-center text-slate-300">
            <p>&copy; 2024 SecureExam. All rights reserved. | Privacy Policy | Terms of Service</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
