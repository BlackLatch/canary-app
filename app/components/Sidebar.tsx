'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, Home, BookOpen, Settings, Users } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const menuItems = [
    { href: '/', label: 'App', icon: Home },
    { href: '/guide', label: 'Guide', icon: BookOpen },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/contacts', label: 'Contacts', icon: Users },
  ];

  return (
    <>
      {/* Toggle Button - Fixed position */}
      <button
        onClick={toggleSidebar}
        className="fixed top-6 left-6 z-50 p-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white transition-all duration-200"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-gray-700" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-white/95 backdrop-blur-md shadow-2xl z-40 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '280px' }}
      >
        <div className="p-6">
          {/* Logo */}
          <div className="mb-8 mt-16">
            <Link href="/" className="flex items-center" onClick={() => setIsOpen(false)}>
              <img 
                src="/canary.png" 
                alt="Canary Logo" 
                className="max-w-12 max-h-12 mr-3 object-contain"
              />
              <span className="text-xl font-playfair font-semibold text-gray-900">Canary</span>
            </Link>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="absolute bottom-6 left-6 right-6">
            <div className="text-xs text-gray-500 text-center">
              <p>Powered by decentralized technology</p>
              <p className="mt-1">Your truth protection starts now</p>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
} 