import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { useUIStore } from '@/stores/ui.store'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const COLORS = {
  navy: '#101A30',
  navyLight: 'rgba(16, 26, 48, 0.1)',
  amber: '#E8A93B',
  amberLight: 'rgba(232, 169, 59, 0.15)',
  success: '#2E7D5B',
  successLight: 'rgba(46, 125, 91, 0.15)',
  danger: '#C1432E',
  dangerLight: 'rgba(193, 67, 46, 0.15)',
  steel: '#66707E',
  steelLight: 'rgba(102, 112, 126, 0.15)',
  palette: ['#101A30', '#E8A93B', '#2E7D5B', '#C1432E', '#66707E', '#1B2A47', '#C4841E', '#4A6FA5']
}

export function CaEvolutionChart() {
  const theme = useUIStore((s) => s.theme)
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const textColor = isDark ? '#9BA3B0' : '#66707E'

  const data = {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
    datasets: [
      {
        label: 'CA (MGA)',
        data: [12000000, 19000000, 15000000, 25000000, 22000000, 30000000, 28000000, 35000000, 32000000, 40000000, 38000000, 45000000],
        borderColor: COLORS.amber,
        backgroundColor: COLORS.amberLight,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: COLORS.amber,
        pointBorderColor: COLORS.amber,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Évolution du Chiffre d\'Affaires Mensuel', color: textColor, font: { weight: 'bold' as const } },
      tooltip: {
        backgroundColor: isDark ? '#1A1F2B' : '#fff',
        titleColor: isDark ? '#E8ECF1' : '#171B22',
        bodyColor: isDark ? '#9BA3B0' : '#66707E',
        borderColor: isDark ? '#2A3140' : '#DEE1E6',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => ` ${ctx.parsed.y.toLocaleString()} MGA`
        }
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor }
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          callback: (v: any) => `${(v / 1000000).toFixed(0)}M`
        }
      }
    }
  }

  return <Line data={data} options={options} />
}

export function TopChantiersChart() {
  const theme = useUIStore((s) => s.theme)
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const textColor = isDark ? '#9BA3B0' : '#66707E'

  const data = {
    labels: ['Chantier Anosy', 'Immeuble Ivandry', 'Pont Ikopa', 'Route RN7', 'Résidence Ambohibao'],
    datasets: [
      {
        label: 'Budget (MGA)',
        data: [120000000, 85000000, 65000000, 45000000, 30000000],
        backgroundColor: COLORS.palette,
        borderRadius: 6,
        borderSkipped: false,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Top 5 Chantiers par Budget', color: textColor, font: { weight: 'bold' as const } },
      tooltip: {
        backgroundColor: isDark ? '#1A1F2B' : '#fff',
        titleColor: isDark ? '#E8ECF1' : '#171B22',
        bodyColor: isDark ? '#9BA3B0' : '#66707E',
        borderColor: isDark ? '#2A3140' : '#DEE1E6',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => ` ${ctx.parsed.y.toLocaleString()} MGA`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor }
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          callback: (v: any) => `${(v / 1000000).toFixed(0)}M`
        }
      }
    }
  }

  return <Bar data={data} options={options} />
}

export function DepensesParCategorieChart() {
  const theme = useUIStore((s) => s.theme)
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const textColor = isDark ? '#9BA3B0' : '#66707E'

  const data = {
    labels: ['Matériaux', 'Main d\'œuvre', 'Equipement', 'Transport', 'Divers'],
    datasets: [
      {
        data: [45, 30, 12, 8, 5],
        backgroundColor: COLORS.palette,
        borderColor: isDark ? '#1A1F2B' : '#fff',
        borderWidth: 2,
        hoverOffset: 8,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: textColor,
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 10,
          font: { size: 12 }
        }
      },
      title: { display: true, text: 'Répartition des Dépenses (%)', color: textColor, font: { weight: 'bold' as const } },
      tooltip: {
        backgroundColor: isDark ? '#1A1F2B' : '#fff',
        titleColor: isDark ? '#E8ECF1' : '#171B22',
        bodyColor: isDark ? '#9BA3B0' : '#66707E',
        borderColor: isDark ? '#2A3140' : '#DEE1E6',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed}%`
        }
      }
    }
  }

  return <Doughnut data={data} options={options} />
}
