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
  amber: '#E8A93B',
  amberLight: 'rgba(232, 169, 59, 0.15)',
  success: '#2E7D5B',
  successLight: 'rgba(46, 125, 91, 0.15)',
  danger: '#C1432E',
  dangerLight: 'rgba(193, 67, 46, 0.15)',
  steel: '#66707E',
  info: '#0284C7',
  infoLight: 'rgba(2, 132, 199, 0.15)',
  palette: ['#0284C7', '#E8A93B', '#2E7D5B', '#C1432E', '#66707E', '#8B5CF6', '#EC4899', '#14B8A6']
}

// -------------------------------------------------------------
// 1. SUPER ADMIN SAAS CHARTS
// -------------------------------------------------------------
export function SaasTenantsGrowthChart() {
  const isDark = useUIStore((s) => s.theme === 'dark')
  const textColor = isDark ? '#9BA3B0' : '#66707E'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const data = {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août'],
    datasets: [
      {
        label: 'Entreprises Abonnées (Tenants)',
        data: [3, 5, 7, 9, 11, 13, 14, 15],
        borderColor: COLORS.danger,
        backgroundColor: COLORS.dangerLight,
        fill: true,
        tension: 0.3,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Évolution des Abonnements SaaS (Tenants)', color: textColor, font: { weight: 'bold' as const } }
    },
    scales: { x: { grid: { color: gridColor }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor } } }
  }

  return <Line data={data} options={options} />
}

// -------------------------------------------------------------
// 2. ADMIN ENTREPRISE CHARTS
// -------------------------------------------------------------
export function UserActivityLogsChart() {
  const isDark = useUIStore((s) => s.theme === 'dark')
  const textColor = isDark ? '#9BA3B0' : '#66707E'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const data = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [
      {
        label: 'Connexions Utilisateurs',
        data: [42, 48, 45, 51, 47, 18, 12],
        backgroundColor: COLORS.info,
        borderRadius: 6,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Activité des Utilisateurs (Connexions/Jour)', color: textColor, font: { weight: 'bold' as const } }
    },
    scales: { x: { grid: { display: false }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor } } }
  }

  return <Bar data={data} options={options} />
}

// -------------------------------------------------------------
// 3. DIRECTION GENERALE CHARTS
// -------------------------------------------------------------
export function CaVsDepensesChart() {
  const isDark = useUIStore((s) => s.theme === 'dark')
  const textColor = isDark ? '#9BA3B0' : '#66707E'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const data = {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
    datasets: [
      {
        label: 'Chiffre d\'Affaires (MGA)',
        data: [25000000, 30000000, 28000000, 35000000, 40000000, 45000000],
        borderColor: COLORS.success,
        backgroundColor: COLORS.successLight,
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Dépenses Totales (MGA)',
        data: [18000000, 20000000, 19000000, 22000000, 25000000, 27000000],
        borderColor: COLORS.danger,
        backgroundColor: COLORS.dangerLight,
        fill: true,
        tension: 0.3,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: textColor } },
      title: { display: true, text: 'Comparatif CA vs Dépenses Globale (MGA)', color: textColor, font: { weight: 'bold' as const } }
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: textColor } },
      y: { grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => `${(v / 1000000).toFixed(0)}M` } }
    }
  }

  return <Line data={data} options={options} />
}

// -------------------------------------------------------------
// 4. COMPTABLE / COMPTABILITE CHARTS
// -------------------------------------------------------------
export function DepensesParPosteChart() {
  const isDark = useUIStore((s) => s.theme === 'dark')
  const textColor = isDark ? '#9BA3B0' : '#66707E'

  const data = {
    labels: ['Matériaux', 'Main d\'œuvre', 'Equipements', 'Sous-traitance', 'Transports'],
    datasets: [
      {
        data: [40, 30, 15, 10, 5],
        backgroundColor: COLORS.palette,
        borderWidth: 2,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: textColor } },
      title: { display: true, text: 'Répartition des Dépenses Comptables (%)', color: textColor, font: { weight: 'bold' as const } }
    }
  }

  return <Doughnut data={data} options={options} />
}

// -------------------------------------------------------------
// 5. CHEF DE PROJET (MULTI-PROJETS) CHARTS
// -------------------------------------------------------------
export function MultiChantiersProgressChart() {
  const isDark = useUIStore((s) => s.theme === 'dark')
  const textColor = isDark ? '#9BA3B0' : '#66707E'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const data = {
    labels: ['Chantier Anosy', 'Immeuble Ivandry', 'Pont Ikopa', 'Route RN7', 'Résidence Ambohibao'],
    datasets: [
      {
        label: 'Avancement Physique (%)',
        data: [85, 65, 45, 90, 30],
        backgroundColor: COLORS.info,
        borderRadius: 6,
      },
      {
        label: 'Consommation Budget (%)',
        data: [80, 70, 40, 88, 25],
        backgroundColor: COLORS.amber,
        borderRadius: 6,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: textColor } },
      title: { display: true, text: 'Avancement Physique vs Consommation Budgétaire (%)', color: textColor, font: { weight: 'bold' as const } }
    },
    scales: { x: { grid: { display: false }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor, max: 100 } } }
  }

  return <Bar data={data} options={options} />
}

// -------------------------------------------------------------
// 6. CHEF DE CHANTIER CHARTS
// -------------------------------------------------------------
export function EquipePresenceDailyChart() {
  const isDark = useUIStore((s) => s.theme === 'dark')
  const textColor = isDark ? '#9BA3B0' : '#66707E'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const data = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    datasets: [
      {
        label: 'Présence Ouvriers (Personnes)',
        data: [18, 19, 18, 20, 19, 12],
        backgroundColor: COLORS.success,
        borderRadius: 6,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Présence Quotidienne de l\'Équipe sur le Site', color: textColor, font: { weight: 'bold' as const } }
    },
    scales: { x: { grid: { display: false }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor } } }
  }

  return <Bar data={data} options={options} />
}

// -------------------------------------------------------------
// 7. RESPONSABLE RH CHARTS
// -------------------------------------------------------------
export function RhEquipesDistributionChart() {
  const isDark = useUIStore((s) => s.theme === 'dark')
  const textColor = isDark ? '#9BA3B0' : '#66707E'

  const data = {
    labels: ['Maçons / Coffreurs', 'Ferrailleurs', 'Électriciens / Plombiers', 'Conducteurs Engins', 'Manœuvres'],
    datasets: [
      {
        data: [18, 10, 8, 5, 7],
        backgroundColor: COLORS.palette,
        borderWidth: 2,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: textColor } },
      title: { display: true, text: 'Répartition de l\'Effectif par Corps de Métier', color: textColor, font: { weight: 'bold' as const } }
    }
  }

  return <Doughnut data={data} options={options} />
}

// -------------------------------------------------------------
// 8. RESPONSABLE MATERIEL CHARTS
// -------------------------------------------------------------
export function ParcUsageRateChart() {
  const isDark = useUIStore((s) => s.theme === 'dark')
  const textColor = isDark ? '#9BA3B0' : '#66707E'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const data = {
    labels: ['Pelles Mécaniques', 'Camions Benne', 'Bétonnières', 'Générateurs', 'Grue à Tour'],
    datasets: [
      {
        label: 'Taux d\'Utilisation (%)',
        data: [88, 75, 92, 60, 80],
        backgroundColor: COLORS.amber,
        borderRadius: 6,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Taux d\'Utilisation du Parc Matériel (%)', color: textColor, font: { weight: 'bold' as const } }
    },
    scales: { x: { grid: { display: false }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor, max: 100 } } }
  }

  return <Bar data={data} options={options} />
}

// -------------------------------------------------------------
// 9. MAGASINIER / STOCKS CHARTS
// -------------------------------------------------------------
export function StockCategoryDistributionChart() {
  const isDark = useUIStore((s) => s.theme === 'dark')
  const textColor = isDark ? '#9BA3B0' : '#66707E'

  const data = {
    labels: ['Ciment / Liants', 'Acier / Ferraillage', 'Granulats / Sable', 'Tuyauterie / Sanitaire', 'Outillage'],
    datasets: [
      {
        data: [35, 28, 20, 10, 7],
        backgroundColor: COLORS.palette,
        borderWidth: 2,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: textColor } },
      title: { display: true, text: 'Répartition des Références en Stock (%)', color: textColor, font: { weight: 'bold' as const } }
    }
  }

  return <Doughnut data={data} options={options} />
}

// -------------------------------------------------------------
// 10. RESPONSABLE COMMERCIAL CHARTS
// -------------------------------------------------------------
export function SalesPipelineChart() {
  const isDark = useUIStore((s) => s.theme === 'dark')
  const textColor = isDark ? '#9BA3B0' : '#66707E'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const data = {
    labels: ['Prospection', 'Devis Saisi', 'Devis Envoyé', 'En Négociation', 'Contrat Signé'],
    datasets: [
      {
        label: 'Montant Pipeline (MGA)',
        data: [45000000, 60000000, 85000000, 50000000, 120000000],
        backgroundColor: COLORS.palette,
        borderRadius: 6,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Pipeline Commercial par Étape (MGA)', color: textColor, font: { weight: 'bold' as const } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor } },
      y: { grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => `${(v / 1000000).toFixed(0)}M` } }
    }
  }

  return <Bar data={data} options={options} />
}

// -------------------------------------------------------------
// 11. OUVRIER / TERRAIN CHARTS
// -------------------------------------------------------------
export function WorkerPersonalAttendanceChart() {
  const isDark = useUIStore((s) => s.theme === 'dark')
  const textColor = isDark ? '#9BA3B0' : '#66707E'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const data = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    datasets: [
      {
        label: 'Heures Validées (h)',
        data: [8, 8.5, 8, 9, 8, 4],
        backgroundColor: COLORS.info,
        borderRadius: 6,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Mes Heures Validées cette Semaine', color: textColor, font: { weight: 'bold' as const } }
    },
    scales: { x: { grid: { display: false }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor } } }
  }

  return <Bar data={data} options={options} />
}
