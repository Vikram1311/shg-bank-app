import React from 'react';

export default function StatCard({ icon: Icon, label, value, gradient, testId, accent = 'primary' }) {
  const gradients = {
    primary: 'from-pink-500 via-rose-500 to-red-500',
    secondary: 'from-amber-400 via-orange-500 to-pink-500',
    accent: 'from-violet-500 via-indigo-500 to-blue-500',
    success: 'from-emerald-400 via-teal-500 to-cyan-500',
    danger: 'from-red-500 via-rose-500 to-pink-500',
    neutral: 'from-slate-500 via-gray-600 to-zinc-700',
  };
  return (
    <div
      data-testid={testId}
      className={`card-clay bg-gradient-to-br ${gradient || gradients[accent]} text-white relative overflow-hidden group`}
    >
      {/* Background decoration */}
      <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-white/10 group-hover:scale-110 transition-transform" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/10" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          {Icon && (
            <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center">
              <Icon className="w-6 h-6" strokeWidth={2.5} />
            </div>
          )}
        </div>
        <p className="text-sm font-bold opacity-90">{label}</p>
        <p className="text-2xl sm:text-3xl font-heading font-black mt-1 break-all">{value}</p>
      </div>
    </div>
  );
}
