import React from 'react'
import {
  Search,
  Filter,
  User,
  Clock,
  AlertTriangle,
  Layers,
  RotateCcw,
  CheckCircle2
} from 'lucide-react'

export function FilterToolbar({
  filters,
  onFilterChange,
  availablePics = [],
  availableJams = [],
  onResetFilters,
  totalAcs,
  filteredAcs,
  sentCount,
  onResetSentStatus,
}) {
  const percentSent = totalAcs > 0 ? Math.round((sentCount / totalAcs) * 100) : 0

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
      {/* Baris Atas: Progress Bar & Statistik */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Antrean Pengiriman AC:
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              {filteredAcs} / {totalAcs} AC
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 size={12} />
              {sentCount} Terkirim ({percentSent}%)
            </span>
          </div>
        </div>

        {/* Progress bar visual */}
        <div className="flex items-center gap-3 flex-1 max-w-xs">
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${percentSent}%` }}
            />
          </div>
          {sentCount > 0 && (
            <button
              onClick={onResetSentStatus}
              title="Reset status pengiriman batch ini"
              className="text-[11px] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 whitespace-nowrap flex items-center gap-1 transition-colors"
            >
              <RotateCcw size={11} />
              Reset Status
            </button>
          )}
        </div>
      </div>

      {/* Baris Bawah: Kontrol Filter & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
        {/* Search Box */}
        <div className="relative lg:col-span-2">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            placeholder="Cari AC, Toko, atau Shipment..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
        </div>

        {/* Filter PIC */}
        <div>
          <select
            value={filters.pic}
            onChange={(e) => onFilterChange('pic', e.target.value)}
            className="w-full py-2 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/50 font-medium"
          >
            <option value="ALL">Semua PIC</option>
            {availablePics.map((p) => (
              <option key={p} value={p}>
                PIC: {p}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Jam */}
        <div>
          <select
            value={filters.jam}
            onChange={(e) => onFilterChange('jam', e.target.value)}
            className="w-full py-2 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/50 font-medium"
          >
            <option value="ALL">Semua Jam</option>
            {availableJams.map((j) => (
              <option key={j} value={j}>
                Jam: {j}
              </option>
            ))}
          </select>
        </div>

        {/* Filter SLA */}
        <div>
          <select
            value={filters.sla}
            onChange={(e) => onFilterChange('sla', e.target.value)}
            className="w-full py-2 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/50 font-medium"
          >
            <option value="ALL">Semua SLA</option>
            <option value="CRITICAL">Kritis (&gt; 6 Jam &amp; &gt; 12 Jam)</option>
            <option value="OVER_1_2">SLA &gt; 1 Jam &amp; &gt; 2 Jam</option>
            <option value="12_JAM">Hanya &gt; 12 Jam</option>
            <option value="6_JAM">Hanya &gt; 6 Jam</option>
            <option value="2_JAM">Hanya &gt; 2 Jam</option>
            <option value="1_JAM">Hanya &gt; 1 Jam</option>
            <option value="UNDER_1">Di Bawah 1 Jam</option>
          </select>
        </div>

        {/* Filter Status Pengiriman */}
        <div>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
            className="w-full py-2 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/50 font-medium"
          >
            <option value="ALL">Semua Status</option>
            <option value="pending">Belum Dikirim ⏳</option>
            <option value="sent">Sudah Dikirim ✅</option>
          </select>
        </div>
      </div>
    </div>
  )
}
