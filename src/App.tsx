import React, { useState } from 'react';
import { ShieldCheck, Search, MapPin, Building2, Bell, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

export default function App() {
  const [search, setSearch] = useState('');
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-[#0F2537] text-white py-4 px-6 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <span className="font-extrabold text-xl">ScotSponsor<span className="text-blue-400">.co.uk</span></span>
        </div>
        <button className="bg-[#005EB8] hover:bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg">
          VIP Telegram Alerts (£9.99/mo)
        </button>
      </header>
      <main className="max-w-5xl mx-auto py-10 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F2537] mb-2">
            Verified Visa Sponsored Jobs in Scotland
          </h1>
          <p className="text-slate-600 text-sm max-w-xl mx-auto">
            Cross-referenced daily against the official UKVI Register of Licensed Sponsors. Zero dead-end applications.
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex gap-2">
          <Search className="w-5 h-5 text-slate-400 my-auto" />
          <input 
            type="text" 
            placeholder="Search role, Edinburgh, Glasgow, Aberdeen, SOC code..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent focus:outline-none text-sm"
          />
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-bold text-base text-slate-900">Junior Cloud Software Engineer</h2>
              <div className="text-xs text-slate-500 flex gap-2 mt-1">
                <span>Edinburgh (EH1)</span> • <span>Skye Logic Solutions Ltd</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-sm text-slate-900">£34,000 / yr</span>
              <div className="text-[11px] text-emerald-600 font-semibold">New Entrant Eligible (£30,960)</div>
            </div>
          </div>
          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
            Active UKVI Licensed Sponsor. Confirmed Certificate of Sponsorship (CoS) allocation for Graduate Route switchers.
          </p>
        </div>
      </main>
    </div>
  );
}
