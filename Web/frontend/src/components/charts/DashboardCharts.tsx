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

export function CaEvolutionChart() {
  const data = {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
    datasets: [
      {
        label: 'CA (MGA)',
        data: [12000000, 19000000, 15000000, 25000000, 22000000, 30000000, 28000000, 35000000, 32000000, 40000000, 38000000, 45000000],
        borderColor: '#003366',
        backgroundColor: 'rgba(0, 51, 102, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Évolution du Chiffre d\'Affaires Mensuel' }
    }
  }

  return <Line data={data} options={options} />
}

export function TopChantiersChart() {
  const data = {
    labels: ['Chantier Anosy', 'Immeuble Ivandry', 'Pont Ikopa', 'Route RN7', 'Résidence Ambohibao'],
    datasets: [
      {
        label: 'Budget (MGA)',
        data: [120000000, 85000000, 65000000, 45000000, 30000000],
        backgroundColor: ['#003366', '#004080', '#e67e22', '#27ae60', '#3498db']
      }
    ]
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Top 5 Chantiers par Budget' }
    }
  }

  return <Bar data={data} options={options} />
}

export function DepensesParCategorieChart() {
  const data = {
    labels: ['Matériaux', 'Main d\'œuvre', 'Equipement', 'Transport', 'Divers'],
    datasets: [
      {
        data: [45, 30, 12, 8, 5],
        backgroundColor: ['#003366', '#e67e22', '#27ae60', '#3498db', '#f39c12']
      }
    ]
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' as const },
      title: { display: true, text: 'Répartition des Dépenses (%)' }
    }
  }

  return <Doughnut data={data} options={options} />
}
