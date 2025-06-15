'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen } from 'lucide-react';

export default function FloatingNavigation() {
  const pathname = usePathname();

  const mainMenuItems = [
    { href: '/', label: 'App', icon: Home },
    { href: '/guide', label: 'Guide', icon: BookOpen },
  ];



  return (
    <div className="fixed top-6 right-6 z-50">
      {/* Main Navigation Block */}
      <div className="bg-white/95 backdrop-blur-md rounded-lg shadow-lg border border-gray-200/50 p-2">
        <div className="flex flex-col gap-1">
          {mainMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-center w-12 h-12 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
} 