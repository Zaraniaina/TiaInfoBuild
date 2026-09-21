import { useEffect, useState, useMemo } from 'react'
import type { Article, MouvementStock, Fournisseur, Chantier, Employe, Depot, EmpruntOutillage, BonReception, BonSortieChantier } from '@/types'
import { stocksService } from '@/services/stocks.service'
import { chantiersService } from '@/services/chantiers.service'
import { rhService } from '@/services/rh.service'
import { useAuthStore } from '@/stores/auth.store'
import { getRolePermissions } from '@/config/roles.config'
import { TableSkeleton } from '@/components/ui/Skeleton'

// Données initiales BTP pour démonstration magasinier si backend vide
const INITIAL_DEPOTS_BTP: Depot[] = [
  {
    id: 1,
    code: 'DEP-MAIN-TANJO',
    nom: 'Dépôt Principal Tanjombato',
    adresse: 'Zone Industrielle Forello, Tanjombato, Antananarivo',
    responsable: 'Rakoto Jean - Magasinier Chef',
    telephone: '+261 34 11 222 33',
    capacite_m2: 1200,
    type: 'magasin_principal',
  },
  {
    id: 2,
    code: 'DEP-CHANT-ANOSY',
    nom: 'Dépôt Tampon Chantier Anosy',
    adresse: 'Site Chantier R+5 Anosy, Antananarivo',
    responsable: 'Nirina Rabemananjara - Conducteur',
    telephone: '+261 32 04 555 66',
    capacite_m2: 250,
    type: 'depot_chantier',
  },
  {
    id: 3,
    code: 'ZONE-EXT-VRAC',
    nom: 'Zone Extérieure Agglomérats & Vrac',
    adresse: 'Parc Extérieur Sud Tanjombato',
    responsable: 'Ranaivo Hery - Gestionnaire Parc',
    telephone: '+261 33 12 345 67',
    capacite_m2: 3500,
    type: 'zone_exterieure',
  },
  {
    id: 4,
    code: 'ARM-OUT-SEC',
    nom: 'Armoire Sécurisée Outillage Portatif',
    adresse: 'Magasin Central - Allée 1',
    responsable: 'Magasinier Dépôt',
    telephone: '+261 34 11 222 33',
    capacite_m2: 45,
    type: 'armoire_outillage',
  },
]

const INITIAL_ARTICLES_BTP: Article[] = [
  {
    id: 101,
    entreprise_id: 1,
    reference: 'MAT-CIM-50',
    nom: 'Ciment CPJ 42.5 (Sac 50kg)',
    description: 'Ciment de structure haute résistance pour béton armé et fondations',
    categorie: 'Liants & Ciments',
    unite: 'sac 50kg',
    stock_actuel: 240,
    seuil_alerte: 50,
    stock_mini: 60,
    prix_achat: 32000,
    prix_vente: 38000,
    marge: 6000,
    tva: 20,
    fournisseur_id: 1,
    emplacement: 'Dépôt Principal Tanjombato',
    is_deleted: false,
    created_at: '2026-01-10',
    updated_at: '2026-09-10',
  },
  {
    id: 102,
    entreprise_id: 1,
    reference: 'MAT-FER-12',
    nom: 'Rond Béton Haute Adhérence HA Ø12mm (Barre 12m)',
    description: 'Armatures en acier FeE500 pour poutres et linteaux',
    categorie: 'Acier & Armatures',
    unite: 'barre 12m',
    stock_actuel: 18,
    seuil_alerte: 30,
    stock_mini: 40,
    prix_achat: 45000,
    prix_vente: 52000,
    marge: 7000,
    tva: 20,
    fournisseur_id: 2,
    emplacement: 'Dépôt Tampon Chantier Anosy',
    is_deleted: false,
    created_at: '2026-01-12',
    updated_at: '2026-09-12',
  },
  {
    id: 103,
    entreprise_id: 1,
    reference: 'MAT-GRA-1525',
    nom: 'Gravillon Concasse 15/25mm (Vrac)',
    description: 'Agglomérats pour mélange béton de fondation et dalles',
    categorie: 'Granulats & VRD',
    unite: 'm³',
    stock_actuel: 5,
    seuil_alerte: 15,
    stock_mini: 20,
    prix_achat: 85000,
    prix_vente: 98000,
    marge: 13000,
    tva: 20,
    fournisseur_id: 3,
    emplacement: 'Zone Extérieure Agglomérats & Vrac',
    is_deleted: false,
    created_at: '2026-02-01',
    updated_at: '2026-09-14',
  },
  {
    id: 104,
    entreprise_id: 1,
    reference: 'MAT-BOIS-COF',
    nom: 'Planche de Coffrage Sapin 4m x 20cm x 27mm',
    description: 'Bois traité pour coffrage de poteaux et voiles béton',
    categorie: 'Coffrage & Étaiement',
    unite: 'pièce',
    stock_actuel: 140,
    seuil_alerte: 30,
    stock_mini: 40,
    prix_achat: 22000,
    prix_vente: 27000,
    marge: 5000,
    tva: 20,
    fournisseur_id: 1,
    emplacement: 'Dépôt Principal Tanjombato',
    is_deleted: false,
    created_at: '2026-02-15',
    updated_at: '2026-09-08',
  },
  {
    id: 105,
    entreprise_id: 1,
    reference: 'MAT-PVC-110',
    nom: 'Tuyau PVC Évacuation Ø110mm L=4m',
    description: 'Conduite eaux usées et pluviales assainissement BTP',
    categorie: 'Tuyauterie & Plomberie',
    unite: 'longueur 4m',
    stock_actuel: 85,
    seuil_alerte: 20,
    stock_mini: 25,
    prix_achat: 34000,
    prix_vente: 41000,
    marge: 7000,
    tva: 20,
    fournisseur_id: 2,
    emplacement: 'Dépôt Tampon Chantier Anosy',
    is_deleted: false,
    created_at: '2026-03-01',
    updated_at: '2026-09-01',
  },
  {
    id: 106,
    entreprise_id: 1,
    reference: 'OUT-PERF-MAX',
    nom: 'Perforeuse SDS-Max 1500W Professionnelle',
    description: 'Perforateur burineur lourd pour perçage béton et démolition',
    categorie: 'Outillage & Équipements',
    unite: 'appareil',
    stock_actuel: 4,
    seuil_alerte: 2,
    stock_mini: 2,
    prix_achat: 1250000,
    prix_vente: 1450000,
    marge: 200000,
    tva: 20,
    fournisseur_id: 3,
    emplacement: 'Armoire Sécurisée Outillage Portatif',
    is_deleted: false,
    created_at: '2026-01-05',
    updated_at: '2026-09-14',
  },
]

const INITIAL_CHANTIERS_FALLBACK = [
  { id: 1, nom: 'Chantier Anosy - Immeuble R+5', phases: ['Gros Œuvre - Dalle 2', 'Fondations', 'Second Œuvre'] },
  { id: 2, nom: 'Villa Ivandry - Privée', phases: ['Longrines', 'Terrassement', 'Finitions'] },
  { id: 3, nom: 'Pontet Ambohimangakely', phases: ['Génie Civil', 'Piles du Pont', 'Enrochement'] },
  { id: 4, nom: 'Piste Rocade Nord Tanjombato', phases: ['Couche de Forme', 'Grave Bitume', 'Assainissement'] },
]

const INITIAL_EMPLOYES_FALLBACK = [
  { id: 1, nom: 'Rakoto Jean', poste: 'Chef de Chantier Principal' },
  { id: 2, nom: 'Ranaivo Hery', poste: 'Chauffeur Camion BTP' },
  { id: 3, nom: 'Nirina Rabemananjara', poste: 'Conducteur de Travaux' },
  { id: 4, nom: 'Raveloson Paul', poste: 'Chef d Équipe Ferraillage' },
  { id: 5, nom: 'Andry Razafy', poste: 'Maçon Qualifié' },
]

const INITIAL_FOURNISSEURS_FALLBACK: Fournisseur[] = [
  {
    id: 1,
    entreprise_id: 1,
    nom: 'Société Cimenterie de Madagascar',
    contact: 'M. Solo - Service Commercial',
    telephone: '+261 34 00 123 45',
    email: 'ventes@cimenterie.mg',
    adresse: 'Zone Industrielle Forello, Tanjombato',
    is_deleted: false,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 2,
    entreprise_id: 1,
    nom: 'Quincaillerie Industrielle Antananarivo',
    contact: 'Mme Fanja',
    telephone: '+261 32 11 987 65',
    email: 'contact@quincaillerie-indus.mg',
    adresse: 'Analakely, Antananarivo',
    is_deleted: false,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 3,
    entreprise_id: 1,
    nom: 'Carrière & Matériaux Malagasy',
    contact: 'M. Denis',
    telephone: '+261 33 05 555 44',
    email: 'commandes@carriere-mg.mg',
    adresse: 'Route d Antsirabe, PK 15',
    is_deleted: false,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
]

const INITIAL_EMPRUNTS: EmpruntOutillage[] = [
  {
    id: 1,
    outillage_nom: 'Bétonnière Électrique 350L Pro',
    code_outil: 'EQP-BET-01',
    emprunteur_nom: 'Rakoto Jean (Chef de Chantier)',
    chantier_nom: 'Chantier Anosy - Immeuble R+5',
    date_emprunt: '2026-09-10',
    date_retour_prevue: '2026-09-20',
    statut: 'en_cours',
    notes: 'Inclus raccord et câble rallonge 25m',
  },
  {
    id: 2,
    outillage_nom: 'Niveau Laser Rotatif Extérieur avec Mire 5m',
    code_outil: 'EQP-LAS-03',
    emprunteur_nom: 'Nirina Rabemananjara',
    chantier_nom: 'Villa Ivandry - Privée',
    date_emprunt: '2026-09-01',
    date_retour_prevue: '2026-09-12',
    statut: 'en_retard',
    notes: 'Vérifier étalonnage de cellule à la restitution',
  },
  {
    id: 3,
    outillage_nom: 'Vibreur à Béton Thermique Ø45mm',
    code_outil: 'EQP-VIB-02',
    emprunteur_nom: 'Raveloson Paul',
    chantier_nom: 'Pontet Ambohimangakely',
    date_emprunt: '2026-08-25',
    date_retour_prevue: '2026-09-05',
    date_retour_effective: '2026-09-06',
    statut: 'restitue',
    etat_retour: 'conforme',
    notes: 'Restitué propre et plein d huile fait',
  },
]

const INITIAL_BONS_RECEPTION: BonReception[] = [
  {
    id: 1,
    numero_bl: 'BL-2026-0941',
    fournisseur_nom: 'Société Cimenterie de Madagascar',
    date_reception: '2026-09-12',
    article_nom: 'Ciment CPJ 42.5 (Sac 50kg)',
    quantite_livree: 100,
    unite: 'sac 50kg',
    etat_livraison: 'conforme',
    controleur_nom: 'Magasinier Dépôt Principal',
    notes: 'Livraison complète sur palette houssée',
  },
  {
    id: 2,
    numero_bl: 'BL-2026-0889',
    fournisseur_nom: 'Quincaillerie Industrielle Antananarivo',
    date_reception: '2026-09-08',
    article_nom: 'Rond Béton HA Ø12mm (Barre 12m)',
    quantite_livree: 50,
    unite: 'barre 12m',
    etat_livraison: 'reserve',
    controleur_nom: 'Magasinier Dépôt Principal',
    notes: '2 barres présentent de légères piques de rouille de surface',
  },
]

const INITIAL_BONS_SORTIE: BonSortieChantier[] = [
  {
    id: 1,
    numero_bon: 'BS-2026-0412',
    chantier_nom: 'Chantier Anosy - Immeuble R+5',
    phase_nom: 'Gros Œuvre - Dalle 2',
    recepteur_nom: 'Ranaivo Hery (Chauffeur Camion BTP)',
    date_sortie: '2026-09-14',
    article_nom: 'Ciment CPJ 42.5 (Sac 50kg)',
    quantite: 40,
    unite: 'sac 50kg',
    code_qr: 'QR-BS-0412-ANOSY-CIM',
  },
  {
    id: 2,
    numero_bon: 'BS-2026-0411',
    chantier_nom: 'Villa Ivandry - Privée',
    phase_nom: 'Fondations',
    recepteur_nom: 'Rakoto Jean (Chef de Chantier Principal)',
    date_sortie: '2026-09-13',
    article_nom: 'Rond Béton HA Ø12mm (Barre 12m)',
    quantite: 15,
    unite: 'barre 12m',
    code_qr: 'QR-BS-0411-IVANDRY-FER',
  },
]

// Unités BTP prédéfinies
const UNITES_BTP_SUGGESTIONS = [
  'sac 50kg',
  'barre 12m',
  'm³',
  'longueur 4m',
  'pièce',
  'kg',
  'litre',
  'touret 50m',
  'palette',
]

type MagasinierTab = 'vue_ensemble' | 'articles' | 'sorties' | 'receptions' | 'outillage' | 'depots' | 'inventaire' | 'fournisseurs'

export function StocksPage() {
  const { user } = useAuthStore()
  const perms = getRolePermissions(user?.role_code || '')

  const [activeTab, setActiveTab] = useState<MagasinierTab>('vue_ensemble')
  const [articles, setArticles] = useState<Article[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [depots, setDepots] = useState<Depot[]>(INITIAL_DEPOTS_BTP)
  const [chantiers, setChantiers] = useState<Array<{ id: number; nom: string; phases?: string[] }>>(INITIAL_CHANTIERS_FALLBACK)
  const [employes, setEmployes] = useState<Array<{ id: number; nom: string; prenom?: string; poste?: string }>>(INITIAL_EMPLOYES_FALLBACK)
  const [emprunts, setEmprunts] = useState<EmpruntOutillage[]>(INITIAL_EMPRUNTS)
  const [bonsReception, setBonsReception] = useState<BonReception[]>(INITIAL_BONS_RECEPTION)
  const [bonsSortie, setBonsSortie] = useState<BonSortieChantier[]>(INITIAL_BONS_SORTIE)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [depotFilter, setDepotFilter] = useState('')
  const [stockAlertFilter, setStockAlertFilter] = useState('')

  // Modals & States
  const [showArticleModal, setShowArticleModal] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [articleForm, setArticleForm] = useState<Partial<Article>>({})
  const [restitutionOpenId, setRestitutionOpenId] = useState<number | null>(null)

  // Modal Dépôt
  const [showDepotModal, setShowDepotModal] = useState(false)
  const [selectedDepot, setSelectedDepot] = useState<Depot | null>(null)
  const [depotForm, setDepotForm] = useState<Partial<Depot>>({})

  const [showMouvementModal, setShowMouvementModal] = useState(false)
  const [mouvementForm, setMouvementForm] = useState<{
    article_id: number
    quantite: number
    type_mouvement: 'entree' | 'sortie' | 'inventaire' | 'ajustement'
    chantier_nom: string
    phase_nom: string
    recepteur_nom: string
    notes: string
    motif_ajustement?: string
  }>({
    article_id: 101,
    quantite: 10,
    type_mouvement: 'sortie',
    chantier_nom: INITIAL_CHANTIERS_FALLBACK[0].nom,
    phase_nom: INITIAL_CHANTIERS_FALLBACK[0].phases[0],
    recepteur_nom: INITIAL_EMPLOYES_FALLBACK[0].nom,
    notes: '',
    motif_ajustement: 'Consommation Chantier',
  })

  // Modal QR Code ÉTIQUETTE DÉPÔT
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrArticle, setQrArticle] = useState<Article | null>(null)

  // Modal Bon de Sortie Printable
  const [showPrintBonModal, setShowPrintBonModal] = useState(false)
  const [selectedBonSortie, setSelectedBonSortie] = useState<BonSortieChantier | null>(null)

  // Modal Nouveau Prêt Outillage
  const [showEmpruntModal, setShowEmpruntModal] = useState(false)
  const [empruntForm, setEmpruntForm] = useState<{
    outillage_nom: string
    code_outil: string
    emprunteur_nom: string
    chantier_nom: string
    date_retour_prevue: string
    notes: string
  }>({
    outillage_nom: 'Bétonnière Électrique 350L Pro',
    code_outil: 'EQP-BET-02',
    emprunteur_nom: INITIAL_EMPLOYES_FALLBACK[0].nom,
    chantier_nom: INITIAL_CHANTIERS_FALLBACK[0].nom,
    date_retour_prevue: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    notes: '',
  })

  // Modal Nouvelle Réception Livraison
  const [showReceptionModal, setShowReceptionModal] = useState(false)
  const [receptionForm, setReceptionForm] = useState<{
    numero_bl: string
    fournisseur_nom: string
    article_nom: string
    quantite_livree: number
    unite: string
    etat_livraison: 'conforme' | 'reserve' | 'refuse'
    notes: string
  }>({
    numero_bl: '',
    fournisseur_nom: INITIAL_FOURNISSEURS_FALLBACK[0].nom,
    article_nom: INITIAL_ARTICLES_BTP[0].nom,
    quantite_livree: 50,
    unite: INITIAL_ARTICLES_BTP[0].unite,
    etat_livraison: 'conforme',
    notes: '',
  })

  // Modal Fournisseur
  const [showFournisseurModal, setShowFournisseurModal] = useState(false)
  const [fournisseurForm, setFournisseurForm] = useState<Partial<Fournisseur>>({})

  // Charge les données globales (Articles, Fournisseurs, Dépôts, Chantiers, Employés)
  const loadData = async () => {
    setLoading(true)
    try {
      const [artData, fournData, depotsData, chantiersData, employesData] = await Promise.all([
        stocksService.getArticles({ search }),
        stocksService.getFournisseurs(),
        stocksService.getDepots().catch(() => []),
        chantiersService.getAll().catch(() => []),
        rhService.getEmployes().catch(() => []),
      ])

      setArticles(artData.length > 0 ? artData : INITIAL_ARTICLES_BTP)
      setFournisseurs(fournData.length > 0 ? fournData : INITIAL_FOURNISSEURS_FALLBACK)
      setDepots(depotsData.length > 0 ? depotsData : INITIAL_DEPOTS_BTP)

      if (chantiersData && chantiersData.length > 0) {
        setChantiers(chantiersData.map((c: Chantier) => ({ id: c.id, nom: c.nom })))
      }

      if (employesData && employesData.length > 0) {
        setEmployes(employesData.map((e: Employe) => ({ id: e.id, nom: `${e.prenom || ''} ${e.nom}`.trim(), poste: e.poste })))
      }
    } catch {
      setArticles(INITIAL_ARTICLES_BTP)
      setFournisseurs(INITIAL_FOURNISSEURS_FALLBACK)
      setDepots(INITIAL_DEPOTS_BTP)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [search])

  // Générateurs Automatiques
  const generateNumeroBonSortie = () => `BS-2026-${Math.floor(1000 + Math.random() * 9000)}`
  const generateNumeroBL = () => `BL-2026-${Math.floor(1000 + Math.random() * 9000)}`
  const generateCodeOutil = () => `EQP-OUT-${Math.floor(10 + Math.random() * 90)}`

  // KPIs Calculés
  const totalStockValueMGA = useMemo(() => {
    return articles.reduce((sum, a) => sum + (a.stock_actuel * (a.prix_achat || a.prix_vente || 0)), 0)
  }, [articles])

  const articlesEnAlerteCount = useMemo(() => {
    return articles.filter(a => a.stock_actuel <= a.stock_mini).length
  }, [articles])

  const empruntsEnCoursCount = useMemo(() => {
    return emprunts.filter(e => e.statut === 'en_cours' || e.statut === 'en_retard').length
  }, [emprunts])

  // Article sélectionné dans la modal de mouvement
  const currentMouvementArticle = useMemo(() => {
    return articles.find(a => a.id === mouvementForm.article_id) || articles[0]
  }, [articles, mouvementForm.article_id])

  // Sauvegarde Article
  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (selectedArticle) {
        const updated = await stocksService.updateArticle(selectedArticle.id, articleForm)
        setArticles(prev => prev.map(a => (a.id === selectedArticle.id ? { ...a, ...updated } : a)))
      } else {
        const newArt = await stocksService.createArticle({
          ...articleForm,
          stock_actuel: Number(articleForm.stock_actuel || 0),
          stock_mini: Number(articleForm.stock_mini || 10),
          seuil_alerte: Number(articleForm.seuil_alerte || 15),
          prix_vente: Number(articleForm.prix_vente || 0),
          prix_achat: Number(articleForm.prix_achat || 0),
        })
        setArticles(prev => [newArt, ...prev])
      }
      setShowArticleModal(false)
    } catch {
      alert("Erreur lors de l'enregistrement du matériau.")
    }
  }

  // Sauvegarde Dépôt
  const handleSaveDepot = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (selectedDepot) {
        const updated = await stocksService.updateDepot(selectedDepot.id, depotForm)
        setDepots(prev => prev.map(d => (d.id === selectedDepot.id ? { ...d, ...updated } : d)))
      } else {
        const newDepot = await stocksService.createDepot({
          ...depotForm,
          type: depotForm.type || 'magasin_principal',
        })
        setDepots(prev => [newDepot, ...prev])
      }
      setShowDepotModal(false)
    } catch {
      alert("Erreur lors de la sauvegarde du dépôt.")
    }
  }

  // Supprimer un Dépôt (soft-delete)
  const handleDeleteDepot = async (depotId: number) => {
    if (!window.confirm('Supprimer ce dépôt ? Les articles liés conservent leur emplacement.')) return
    try {
      await stocksService.deleteDepot(depotId)
    } catch {
      // L'API retourne 204 même si hors ligne — on supprime quand même localement
    }
    setDepots(prev => prev.filter(d => d.id !== depotId))
  }

  // Sauvegarde Mouvement & Bon de Sortie / Réception
  const handleSaveMouvement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentMouvementArticle) return

    try {
      await stocksService.adjustStock(currentMouvementArticle.id, {
        quantite: mouvementForm.quantite,
        type_mouvement: mouvementForm.type_mouvement,
        notes: mouvementForm.notes,
      })

      // Update local state
      const updatedStock =
        mouvementForm.type_mouvement === 'entree' || mouvementForm.type_mouvement === 'inventaire'
          ? currentMouvementArticle.stock_actuel + mouvementForm.quantite
          : Math.max(0, currentMouvementArticle.stock_actuel - mouvementForm.quantite)

      setArticles(prev => prev.map(a => (a.id === currentMouvementArticle.id ? { ...a, stock_actuel: updatedStock } : a)))

      // Si c'est une sortie chantier, générer automatiquement un Bon de Sortie
      if (mouvementForm.type_mouvement === 'sortie') {
        const newBon: BonSortieChantier = {
          id: Date.now(),
          numero_bon: generateNumeroBonSortie(),
          chantier_nom: mouvementForm.chantier_nom || chantiers[0]?.nom || 'Chantier Affecté',
          phase_nom: mouvementForm.phase_nom || 'Phase Gros Œuvre',
          recepteur_nom: mouvementForm.recepteur_nom || employes[0]?.nom || 'Chauffeur / Chef d Équipe',
          date_sortie: new Date().toISOString().split('T')[0],
          article_nom: currentMouvementArticle.nom,
          quantite: mouvementForm.quantite,
          unite: currentMouvementArticle.unite,
          code_qr: `QR-BS-${Date.now().toString().slice(-6)}`,
        }
        setBonsSortie(prev => [newBon, ...prev])
        setSelectedBonSortie(newBon)
        setShowPrintBonModal(true)
      }

      setShowMouvementModal(false)
    } catch {
      alert("Erreur lors de l'enregistrement du mouvement.")
    }
  }

  // Saisie Réception Livraison Fournisseur
  const handleSaveReception = (e: React.FormEvent) => {
    e.preventDefault()
    const targetArt = articles.find(a => a.nom === receptionForm.article_nom)

    const newRec: BonReception = {
      id: Date.now(),
      numero_bl: receptionForm.numero_bl || generateNumeroBL(),
      fournisseur_nom: receptionForm.fournisseur_nom,
      date_reception: new Date().toISOString().split('T')[0],
      article_nom: receptionForm.article_nom,
      quantite_livree: Number(receptionForm.quantite_livree),
      unite: receptionForm.unite || targetArt?.unite || 'unité',
      etat_livraison: receptionForm.etat_livraison,
      controleur_nom: user ? `${user.prenom || ''} ${user.nom}` : 'Magasinier Dépôt Principal',
      notes: receptionForm.notes,
    }
    setBonsReception(prev => [newRec, ...prev])

    // Ajuster automatiquement le stock si l'article existe
    if (targetArt) {
      setArticles(prev =>
        prev.map(a => (a.id === targetArt.id ? { ...a, stock_actuel: a.stock_actuel + Number(receptionForm.quantite_livree) } : a))
      )
    }
    setShowReceptionModal(false)
  }

  // Saisie Emprunt Outillage
  const handleSaveEmprunt = (e: React.FormEvent) => {
    e.preventDefault()
    const newEmp: EmpruntOutillage = {
      id: Date.now(),
      outillage_nom: empruntForm.outillage_nom,
      code_outil: empruntForm.code_outil || generateCodeOutil(),
      emprunteur_nom: empruntForm.emprunteur_nom,
      chantier_nom: empruntForm.chantier_nom,
      date_emprunt: new Date().toISOString().split('T')[0],
      date_retour_prevue: empruntForm.date_retour_prevue,
      statut: 'en_cours',
      notes: empruntForm.notes,
    }
    setEmprunts(prev => [newEmp, ...prev])
    setShowEmpruntModal(false)
  }

  // Marquer restitution d'outillage
  const handleRestituerOutil = (empruntId: number, etat: 'conforme' | 'a_reparer' | 'nettoyage_requis') => {
    setEmprunts(prev =>
      prev.map(e =>
        e.id === empruntId
          ? {
              ...e,
              statut: 'restitue',
              etat_retour: etat,
              date_retour_effective: new Date().toISOString().split('T')[0],
            }
          : e
      )
    )
  }

  // Enregistrer Fournisseur
  const handleSaveFournisseur = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const created = await stocksService.createFournisseur(fournisseurForm)
      setFournisseurs(prev => [created, ...prev])
      setShowFournisseurModal(false)
    } catch {
      alert('Erreur lors de la sauvegarde du fournisseur.')
    }
  }

  // Exporter CSV Articles
  const exportArticlesCSV = () => {
    const headers = ['Reference', 'Designation', 'Categorie', 'Emplacement', 'Stock Actuel', 'Stock Mini', 'Unite', 'Prix PUMP (MGA)']
    const rows = articles.map(a => [
      a.reference,
      `"${a.nom}"`,
      a.categorie || 'BTP',
      a.emplacement || 'Dépôt',
      a.stock_actuel,
      a.stock_mini,
      a.unite,
      a.prix_vente || a.prix_achat,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `inventaire_magasinier_btp_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Articles filtrés
  const filteredArticles = articles.filter(a => {
    const matchSearch =
      a.nom.toLowerCase().includes(search.toLowerCase()) ||
      a.reference.toLowerCase().includes(search.toLowerCase()) ||
      (a.emplacement && a.emplacement.toLowerCase().includes(search.toLowerCase()))

    const matchCategory = !categoryFilter || a.categorie === categoryFilter
    const matchDepot = !depotFilter || (a.emplacement && a.emplacement.includes(depotFilter))

    let matchAlert = true
    if (stockAlertFilter === 'rupture') matchAlert = a.stock_actuel === 0
    else if (stockAlertFilter === 'bas') matchAlert = a.stock_actuel <= a.stock_mini && a.stock_actuel > 0
    else if (stockAlertFilter === 'ok') matchAlert = a.stock_actuel > a.stock_mini

    return matchSearch && matchCategory && matchDepot && matchAlert
  })

  // Liste des catégories BTP disponibles
  const categoriesList = useMemo(() => {
    const setCat = new Set<string>()
    articles.forEach(a => {
      if (a.categorie) setCat.add(a.categorie)
    })
    return Array.from(setCat)
  }, [articles])

  // Liste des Outillages disponible dans le catalogue pour emprunt rapide
  const outillagesMagasin = useMemo(() => {
    return articles.filter(a => a.categorie === 'Outillage & Équipements')
  }, [articles])

  return (
    <div className="container-fluid py-4">
      {/* En-tête de Page du Magasinier */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-1">
              <i className="bi bi-box-seam me-1.5"></i>Gestion Dépôts & Magasins BTP
            </span>
            <span className="badge bg-secondary bg-opacity-10 text-secondary border px-2 py-1">
              <i className="bi bi-building me-1"></i>{depots.length} Dépôt(s) Actif(s)
            </span>
          </div>
          <h2 className="mb-1 fw-bold text-dark font-display">Espace Magasinier & Logistique Chantier</h2>
          <p className="text-secondary mb-0 small">
            Gestion multi-dépôts, réquisitions chantiers, réceptions fournisseurs, outillage et auto-numérotation
          </p>
        </div>

        {/* Boutons d'Action Rapide */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {perms.canAddMouvementStock && (
            <button
              className="btn btn-outline-primary fw-semibold shadow-sm"
              onClick={() => {
                const firstArt = articles[0] || INITIAL_ARTICLES_BTP[0]
                setMouvementForm({
                  article_id: firstArt.id,
                  quantite: 10,
                  type_mouvement: 'sortie',
                  chantier_nom: chantiers[0]?.nom || 'Chantier Anosy',
                  phase_nom: 'Gros Œuvre - Dalle',
                  recepteur_nom: employes[0]?.nom || 'Chef de Chantier',
                  notes: '',
                  motif_ajustement: 'Consommation Chantier',
                })
                setShowMouvementModal(true)
              }}
            >
              <i className="bi bi-box-arrow-up-right me-1.5 text-primary"></i>Émettre Bon de Sortie
            </button>
          )}

          {perms.canCreateArticle && (
            <button
              className="btn btn-primary fw-semibold shadow-sm"
              onClick={() => {
                setSelectedArticle(null)
                const cat = 'Liants & Ciments'
                setArticleForm({
                  stock_actuel: 0,
                  stock_mini: 20,
                  seuil_alerte: 15,
                  prix_achat: 0,
                  prix_vente: 0,
                  unite: 'sac 50kg',
                  categorie: cat,
                  emplacement: depots[0]?.nom || 'Dépôt Principal Tanjombato',
                })
                setShowArticleModal(true)
              }}
            >
              <i className="bi bi-plus-lg me-1.5"></i>Ajouter un Matériau
            </button>
          )}
        </div>
      </div>

      {/* Barre de Navigation par Onglets Métier Magasinier */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-2 bg-light rounded">
          <ul className="nav nav-pills nav-fill gap-1">
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold py-2.5 ${activeTab === 'vue_ensemble' ? 'active shadow-sm' : 'text-secondary'}`}
                onClick={() => setActiveTab('vue_ensemble')}
              >
                <i className="bi bi-speedometer2 me-2"></i>Vue d'ensemble
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold py-2.5 ${activeTab === 'articles' ? 'active shadow-sm' : 'text-secondary'}`}
                onClick={() => setActiveTab('articles')}
              >
                <i className="bi bi-boxes me-2"></i>Matériaux ({articles.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold py-2.5 ${activeTab === 'depots' ? 'active shadow-sm' : 'text-secondary'}`}
                onClick={() => setActiveTab('depots')}
              >
                <i className="bi bi-building me-2"></i>Dépôts BTP ({depots.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold py-2.5 ${activeTab === 'sorties' ? 'active shadow-sm' : 'text-secondary'}`}
                onClick={() => setActiveTab('sorties')}
              >
                <i className="bi bi-truck me-2"></i>Sorties Chantiers ({bonsSortie.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold py-2.5 ${activeTab === 'receptions' ? 'active shadow-sm' : 'text-secondary'}`}
                onClick={() => setActiveTab('receptions')}
              >
                <i className="bi bi-clipboard-check me-2"></i>Bons Réception ({bonsReception.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold py-2.5 ${activeTab === 'outillage' ? 'active shadow-sm' : 'text-secondary'}`}
                onClick={() => setActiveTab('outillage')}
              >
                <i className="bi bi-tools me-2"></i>Outillage ({emprunts.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold py-2.5 ${activeTab === 'inventaire' ? 'active shadow-sm' : 'text-secondary'}`}
                onClick={() => setActiveTab('inventaire')}
              >
                <i className="bi bi-arrow-left-right me-2"></i>Ajustements & Pertes
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold py-2.5 ${activeTab === 'fournisseurs' ? 'active shadow-sm' : 'text-secondary'}`}
                onClick={() => setActiveTab('fournisseurs')}
              >
                <i className="bi bi-shop me-2"></i>Fournisseurs ({fournisseurs.length})
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Chargement */}
      {loading ? (
        <div className="card border-0 shadow-sm p-4">
          <TableSkeleton rows={8} columns={6} />
        </div>
      ) : (
        <>
          {/* TAB 1: VUE D'ENSEMBLE & KPIS MAGASINIER */}
          {activeTab === 'vue_ensemble' && (
            <div>
              {/* Grille des 4 Cartes KPI */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                  <div className="kpi-card h-100 border-0 shadow-sm">
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="kpi-label">Valeur du Stock Magasin</div>
                        <div className="kpi-value font-mono text-dark fs-4">
                          {totalStockValueMGA.toLocaleString()} MGA
                        </div>
                        <small className="text-muted fs-7">Valorisation au PUMP</small>
                      </div>
                      <div className="kpi-icon bg-primary bg-opacity-10 text-primary">
                        <i className="bi bi-cash-stack"></i>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                  <div className="kpi-card h-100 border-0 shadow-sm">
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="kpi-label">Références Matériaux</div>
                        <div className="kpi-value font-mono text-dark fs-4">{articles.length}</div>
                        <small className="text-success fs-7">
                          <i className="bi bi-check-circle me-1"></i>Dans {depots.length} dépôt(s)
                        </small>
                      </div>
                      <div className="kpi-icon bg-info bg-opacity-10 text-info">
                        <i className="bi bi-box-seam"></i>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                  <div className="kpi-card h-100 border-0 shadow-sm">
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="kpi-label">Alertes Réapprovisionnement</div>
                        <div className="kpi-value font-mono text-warning fs-4">{articlesEnAlerteCount}</div>
                        <small className="text-warning fs-7">Stock bas ou rupture</small>
                      </div>
                      <div className="kpi-icon bg-warning bg-opacity-10 text-warning">
                        <i className="bi bi-exclamation-triangle"></i>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                  <div className="kpi-card h-100 border-0 shadow-sm">
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="kpi-label">Outillages Prêtés</div>
                        <div className="kpi-value font-mono text-primary fs-4">{empruntsEnCoursCount}</div>
                        <small className="text-primary fs-7">En utilisation chantier</small>
                      </div>
                      <div className="kpi-icon bg-secondary bg-opacity-10 text-secondary">
                        <i className="bi bi-tools"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panneau d'Alerte Stock Critique s'il y a des ruptures */}
              {articlesEnAlerteCount > 0 && (
                <div className="alert alert-warning border border-warning border-opacity-25 bg-warning bg-opacity-10 rounded-3 p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-3">
                    <div className="p-2 bg-warning bg-opacity-25 text-warning rounded-circle">
                      <i className="bi bi-shield-exclamation fs-5"></i>
                    </div>
                    <div>
                      <h6 className="mb-0 fw-bold text-dark">
                        Attention : {articlesEnAlerteCount} réference(s) nécessitent un réapprovisionnement
                      </h6>
                      <small className="text-secondary">
                        Certains matériaux indispensables aux chantiers en cours sont sous leur seuil de sécurité.
                      </small>
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-warning fw-semibold"
                    onClick={() => {
                      setActiveTab('articles')
                      setStockAlertFilter('bas')
                    }}
                  >
                    Voir les matériaux en alerte
                  </button>
                </div>
              )}

              {/* Tableaux Résumés Rapides */}
              <div className="row g-4">
                {/* Dernières Sorties Chantiers */}
                <div className="col-12 col-lg-6">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-header bg-transparent border-0 pt-3 px-3 d-flex align-items-center justify-content-between">
                      <h6 className="fw-bold text-dark mb-0">
                        <i className="bi bi-truck me-2 text-primary"></i>Dernières Sorties pour Chantiers
                      </h6>
                      <button
                        className="btn btn-sm btn-link text-decoration-none text-primary"
                        onClick={() => setActiveTab('sorties')}
                      >
                        Voir tout
                      </button>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>N° Bon</th>
                            <th>Matériau</th>
                            <th>Chantier</th>
                            <th>Qté</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bonsSortie.slice(0, 4).map(bs => (
                            <tr key={bs.id}>
                              <td className="font-mono small fw-bold text-primary">{bs.numero_bon}</td>
                              <td className="fw-medium text-dark">{bs.article_nom}</td>
                              <td className="small text-secondary">{bs.chantier_nom}</td>
                              <td className="font-mono fw-bold">{bs.quantite} {bs.unite}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Prêts d'Outillages en cours */}
                <div className="col-12 col-lg-6">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-header bg-transparent border-0 pt-3 px-3 d-flex align-items-center justify-content-between">
                      <h6 className="fw-bold text-dark mb-0">
                        <i className="bi bi-tools me-2 text-primary"></i>Outillage Actuellement sur Chantier
                      </h6>
                      <button
                        className="btn btn-sm btn-link text-decoration-none text-primary"
                        onClick={() => setActiveTab('outillage')}
                      >
                        Gérer les prêts
                      </button>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Outillage</th>
                            <th>Emprunteur</th>
                            <th>Retour Prévu</th>
                            <th>État</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emprunts.slice(0, 4).map(emp => (
                            <tr key={emp.id}>
                              <td className="fw-medium text-dark">{emp.outillage_nom}</td>
                              <td className="small text-secondary">{emp.emprunteur_nom}</td>
                              <td className="font-mono small">{emp.date_retour_prevue}</td>
                              <td>
                                {emp.statut === 'en_retard' ? (
                                  <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">
                                    En Retard
                                  </span>
                                ) : emp.statut === 'en_cours' ? (
                                  <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">
                                    En Cours
                                  </span>
                                ) : (
                                  <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                    Restitué
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CATALOGUE MATÉRIAUX & ARTICLES BTP */}
          {activeTab === 'articles' && (
            <div>
              {/* Barre de Filtres */}
              <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                  <div className="row g-3 align-items-center">
                    <div className="col-12 col-md-3">
                      <div className="input-group">
                        <span className="input-group-text bg-light border-end-0">
                          <i className="bi bi-search text-muted"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control bg-light border-start-0"
                          placeholder="Rechercher désignation, réf..."
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="col-12 col-sm-6 col-md-3">
                      <select
                        className="form-select bg-light"
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                      >
                        <option value="">Toutes les catégories BTP</option>
                        {categoriesList.map(cat => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-sm-6 col-md-3">
                      <select
                        className="form-select bg-light"
                        value={depotFilter}
                        onChange={e => setDepotFilter(e.target.value)}
                      >
                        <option value="">Tous les dépôts / zones</option>
                        {depots.map(d => (
                          <option key={d.id} value={d.nom}>
                            {d.nom}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-sm-6 col-md-3 d-flex gap-2">
                      <select
                        className="form-select bg-light"
                        value={stockAlertFilter}
                        onChange={e => setStockAlertFilter(e.target.value)}
                      >
                        <option value="">Tous les niveaux</option>
                        <option value="ok">En Stock</option>
                        <option value="bas">Stock Bas</option>
                        <option value="rupture">Rupture</option>
                      </select>
                      <button
                        className="btn btn-outline-secondary"
                        title="Exporter CSV"
                        onClick={exportArticlesCSV}
                      >
                        <i className="bi bi-download"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table des Matériaux */}
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Référence</th>
                        <th>Désignation Matériau</th>
                        <th>Catégorie BTP</th>
                        <th>Emplacement Dépôt</th>
                        <th>Stock Actuel</th>
                        <th>Stock Sécurité</th>
                        <th>Prix PUMP (MGA)</th>
                        <th>Valeur Totale</th>
                        <th>État</th>
                        <th className="text-end" style={{ minWidth: '130px' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArticles.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="text-center py-5 text-muted">
                            <i className="bi bi-inbox fs-3 d-block mb-2"></i>
                            Aucun matériau trouvé pour ces critères de recherche.
                          </td>
                        </tr>
                      ) : (
                        filteredArticles.map(art => {
                          const isRupture = art.stock_actuel === 0
                          const isLow = art.stock_actuel <= art.stock_mini && art.stock_actuel > 0
                          const unitPrice = art.prix_vente || art.prix_achat || 0
                          const totalVal = art.stock_actuel * unitPrice

                          return (
                            <tr key={art.id}>
                              <td className="font-mono fw-bold text-dark">{art.reference}</td>
                              <td>
                                <div className="fw-semibold text-dark">{art.nom}</div>
                                <small className="text-muted text-truncate d-block" style={{ maxWidth: '280px' }}>
                                  {art.description || '-'}
                                </small>
                              </td>
                              <td>
                                <span className="badge bg-secondary bg-opacity-10 text-secondary border">
                                  {art.categorie || 'Matériau BTP'}
                                </span>
                              </td>
                              <td>
                                <span className="small text-dark font-mono bg-light px-2 py-1 rounded border">
                                  <i className="bi bi-geo-alt me-1 text-muted"></i>
                                  {art.emplacement || 'Dépôt Principal'}
                                </span>
                              </td>
                              <td className="font-mono fs-6 fw-bold text-dark">
                                {art.stock_actuel} <small className="text-muted fw-normal fs-7">{art.unite}</small>
                              </td>
                              <td className="font-mono text-muted">{art.stock_mini}</td>
                              <td className="font-mono text-secondary fw-semibold">
                                {unitPrice.toLocaleString()} MGA
                              </td>
                              <td className="font-mono text-dark fw-bold">{totalVal.toLocaleString()} MGA</td>
                              <td>
                                {isRupture ? (
                                  <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">
                                    Rupture
                                  </span>
                                ) : isLow ? (
                                  <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">
                                    Stock Bas
                                  </span>
                                ) : (
                                  <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                    En Stock
                                  </span>
                                )}
                              </td>
                              <td className="text-end">
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-secondary"
                                    title="Afficher Étiquette QR Code Dépôt"
                                    onClick={() => {
                                      setQrArticle(art)
                                      setShowQrModal(true)
                                    }}
                                  >
                                    <i className="bi bi-qr-code"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-secondary"
                                    title="Modifier le matériau"
                                    onClick={() => {
                                      setSelectedArticle(art)
                                      setArticleForm(art)
                                      setShowArticleModal(true)
                                    }}
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CRUD DÉPÔTS BTP (GESTION DES DÉPÔTS) */}
          {activeTab === 'depots' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-dark mb-0">
                  <i className="bi bi-building me-2 text-primary"></i>Gestion des Dépôts, Entrepôts & Zones BTP
                </h5>
                {perms.canCreateArticle && (
                  <button
                    className="btn btn-primary btn-sm fw-semibold"
                    onClick={() => {
                      setSelectedDepot(null)
                      setDepotForm({
                        type: 'magasin_principal',
                        capacite_m2: 500,
                      })
                      setShowDepotModal(true)
                    }}
                  >
                    <i className="bi bi-plus-lg me-1.5"></i>Nouveau Dépôt / Zone
                  </button>
                )}
              </div>

              <div className="row g-4">
                {depots.map(dep => {
                  const articleCount = articles.filter(a => a.emplacement && a.emplacement.includes(dep.nom)).length

                  return (
                    <div key={dep.id} className="col-12 col-md-6 col-lg-4">
                      <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <span className="badge bg-secondary bg-opacity-10 text-secondary border font-mono">
                              {dep.code}
                            </span>
                            {dep.type === 'magasin_principal' ? (
                              <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">
                                Dépôt Principal
                              </span>
                            ) : dep.type === 'depot_chantier' ? (
                              <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25">
                                Dépôt Chantier
                              </span>
                            ) : dep.type === 'zone_exterieure' ? (
                              <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">
                                Zone Extérieure / Vrac
                              </span>
                            ) : (
                              <span className="badge bg-secondary bg-opacity-10 text-secondary border">
                                Outillage Sécurisé
                              </span>
                            )}
                          </div>

                          <h5 className="fw-bold text-dark mb-2">{dep.nom}</h5>
                          <p className="text-muted small mb-2">
                            <i className="bi bi-geo-alt me-1.5"></i>
                            {dep.adresse || 'Antananarivo, Madagascar'}
                          </p>

                          <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-3 small">
                            <span className="text-secondary">
                              <i className="bi bi-person me-1"></i>
                              {dep.responsable || 'Magasinier'}
                            </span>
                            <span className="badge bg-light text-dark border font-mono">
                              {articleCount} réference(s)
                            </span>
                          </div>
                        </div>
                        <div className="card-footer bg-light border-0 d-flex justify-content-between align-items-center">
                          <small className="text-muted font-mono">{dep.capacite_m2 ? `${dep.capacite_m2} m²` : 'Taille std'}</small>
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => {
                                setSelectedDepot(dep)
                                setDepotForm(dep)
                                setShowDepotModal(true)
                              }}
                            >
                              <i className="bi bi-pencil me-1"></i>Modifier
                            </button>
                            {perms.canCreateArticle && (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteDepot(dep.id)}
                              >
                                <i className="bi bi-trash3"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 4: BONS DE RÉCEPTION FOURNISSEURS */}
          {activeTab === 'receptions' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-dark mb-0">
                  <i className="bi bi-clipboard-check me-2 text-primary"></i>Historique des Réceptions Livraison Fournisseur
                </h5>
                <button
                  className="btn btn-primary fw-semibold btn-sm"
                  onClick={() => {
                    setReceptionForm({
                      numero_bl: generateNumeroBL(),
                      fournisseur_nom: fournisseurs[0]?.nom || 'Cimenterie de Madagascar',
                      article_nom: articles[0]?.nom || 'Ciment CPJ 42.5 (Sac 50kg)',
                      quantite_livree: 50,
                      unite: articles[0]?.unite || 'sac 50kg',
                      etat_livraison: 'conforme',
                      notes: '',
                    })
                    setShowReceptionModal(true)
                  }}
                >
                  <i className="bi bi-plus-lg me-1.5"></i>Enregistrer une Réception
                </button>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>N° Bon Livraison (BL)</th>
                        <th>Fournisseur</th>
                        <th>Matériau Réceptionné</th>
                        <th>Quantité Livrée</th>
                        <th>Date Réception</th>
                        <th>Contrôleur Magasin</th>
                        <th>Conformité</th>
                        <th>Notes / Écarts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bonsReception.map(rec => (
                        <tr key={rec.id}>
                          <td className="font-mono fw-bold text-primary">{rec.numero_bl}</td>
                          <td className="fw-medium text-dark">{rec.fournisseur_nom}</td>
                          <td className="fw-semibold text-dark">{rec.article_nom}</td>
                          <td className="font-mono fw-bold">
                            {rec.quantite_livree} {rec.unite}
                          </td>
                          <td className="font-mono small">{rec.date_reception}</td>
                          <td className="small text-secondary">{rec.controleur_nom}</td>
                          <td>
                            {rec.etat_livraison === 'conforme' ? (
                              <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                Conforme
                              </span>
                            ) : rec.etat_livraison === 'reserve' ? (
                              <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">
                                Avec Réserves
                              </span>
                            ) : (
                              <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">
                                Refusé
                              </span>
                            )}
                          </td>
                          <td className="small text-muted">{rec.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BONS DE SORTIE & ALLOCATION CHANTIERS */}
          {activeTab === 'sorties' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-dark mb-0">
                  <i className="bi bi-truck me-2 text-primary"></i>Bons de Sortie Matériaux pour Chantiers
                </h5>
                <button
                  className="btn btn-outline-primary fw-semibold btn-sm"
                  onClick={() => {
                    const firstArt = articles[0] || INITIAL_ARTICLES_BTP[0]
                    setMouvementForm({
                      article_id: firstArt.id,
                      quantite: 10,
                      type_mouvement: 'sortie',
                      chantier_nom: chantiers[0]?.nom || 'Chantier Anosy',
                      phase_nom: 'Gros Œuvre - Dalle',
                      recepteur_nom: employes[0]?.nom || 'Chef de Chantier',
                      notes: '',
                      motif_ajustement: 'Consommation Chantier',
                    })
                    setShowMouvementModal(true)
                  }}
                >
                  <i className="bi bi-box-arrow-up-right me-1.5"></i>Émettre un Bon de Sortie
                </button>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>N° Bon de Sortie</th>
                        <th>Chantier Destinataire</th>
                        <th>Phase d'Ouvrage</th>
                        <th>Matériau Délivré</th>
                        <th>Quantité</th>
                        <th>Récepteur / Conducteur</th>
                        <th>Date Sortie</th>
                        <th className="text-end">Imprimer Bon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bonsSortie.map(bs => (
                        <tr key={bs.id}>
                          <td className="font-mono fw-bold text-primary">{bs.numero_bon}</td>
                          <td className="fw-semibold text-dark">{bs.chantier_nom}</td>
                          <td className="small text-secondary">{bs.phase_nom || 'Gros Œuvre'}</td>
                          <td className="fw-medium text-dark">{bs.article_nom}</td>
                          <td className="font-mono fw-bold text-dark">
                            {bs.quantite} {bs.unite}
                          </td>
                          <td className="small text-secondary">{bs.recepteur_nom}</td>
                          <td className="font-mono small">{bs.date_sortie}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => {
                                setSelectedBonSortie(bs)
                                setShowPrintBonModal(true)
                              }}
                            >
                              <i className="bi bi-printer me-1"></i>Imprimer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: OUTILLAGE & ÉQUIPEMENTS MAGASIN */}
          {activeTab === 'outillage' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-dark mb-0">
                  <i className="bi bi-tools me-2 text-primary"></i>Gestion des Emprunts d'Outillage Électroportatif
                </h5>
                <button
                  className="btn btn-primary fw-semibold btn-sm"
                  onClick={() => {
                    const firstTool = outillagesMagasin[0]
                    setEmpruntForm({
                      outillage_nom: firstTool ? firstTool.nom : 'Bétonnière Électrique 350L Pro',
                      code_outil: firstTool ? firstTool.reference : generateCodeOutil(),
                      emprunteur_nom: employes[0]?.nom || 'Rakoto Jean',
                      chantier_nom: chantiers[0]?.nom || 'Chantier Anosy',
                      date_retour_prevue: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                      notes: '',
                    })
                    setShowEmpruntModal(true)
                  }}
                >
                  <i className="bi bi-plus-lg me-1.5"></i>Déclarer un Emprunt d'Outil
                </button>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Code Outil</th>
                        <th>Désignation Outillage</th>
                        <th>Emprunteur (Chef/Ouvrier)</th>
                        <th>Chantier Destination</th>
                        <th>Date Emprunt</th>
                        <th>Retour Prévu</th>
                        <th>Statut Emprunt</th>
                        <th className="text-end">Action Restitution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emprunts.map(emp => (
                        <tr key={emp.id}>
                          <td className="font-mono fw-bold text-dark">{emp.code_outil || 'EQP-OUT'}</td>
                          <td className="fw-semibold text-dark">{emp.outillage_nom}</td>
                          <td className="small text-secondary">{emp.emprunteur_nom}</td>
                          <td className="small text-secondary">{emp.chantier_nom}</td>
                          <td className="font-mono small">{emp.date_emprunt}</td>
                          <td className="font-mono small">{emp.date_retour_prevue}</td>
                          <td>
                            {emp.statut === 'restitue' ? (
                              <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                Restitué ({emp.etat_retour})
                              </span>
                            ) : emp.statut === 'en_retard' ? (
                              <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">
                                En Retard
                              </span>
                            ) : (
                              <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">
                                Sur Chantier
                              </span>
                            )}
                          </td>
                          <td className="text-end">
                            {emp.statut !== 'restitue' ? (
                              <div className="dropdown d-inline-block">
                                <button
                                  className="btn btn-sm btn-outline-success dropdown-toggle"
                                  type="button"
                                  aria-haspopup="true"
                                  aria-expanded={restitutionOpenId === emp.id}
                                  onClick={() => setRestitutionOpenId(restitutionOpenId === emp.id ? null : emp.id)}
                                >
                                  Restituer
                                </button>
                                <ul className={`dropdown-menu dropdown-menu-end shadow border-0${restitutionOpenId === emp.id ? ' show' : ''}`}>
                                  <li>
                                    <button
                                      className="dropdown-item small"
                                      onClick={() => { setRestitutionOpenId(null); handleRestituerOutil(emp.id, 'conforme') }}
                                    >
                                      <i className="bi bi-check-circle text-success me-2"></i>Conforme / Bon état
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      className="dropdown-item small"
                                      onClick={() => { setRestitutionOpenId(null); handleRestituerOutil(emp.id, 'nettoyage_requis') }}
                                    >
                                      <i className="bi bi-droplet text-warning me-2"></i>À nettoyer
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      className="dropdown-item small text-danger"
                                      onClick={() => { setRestitutionOpenId(null); handleRestituerOutil(emp.id, 'a_reparer') }}
                                    >
                                      <i className="bi bi-wrench text-danger me-2"></i>Endommagé / À réparer
                                    </button>
                                  </li>
                                </ul>
                              </div>
                            ) : (
                              <span className="text-muted small">
                                <i className="bi bi-check-all text-success me-1"></i>Clôturé
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: INVENTAIRE & AJUSTEMENTS */}
          {activeTab === 'inventaire' && (
            <div>
              <div className="card border-0 shadow-sm p-4 mb-4">
                <h5 className="fw-bold text-dark mb-3">
                  <i className="bi bi-arrow-left-right me-2 text-primary"></i>Saisie d'Ajustement d'Inventaire Opérationnel
                </h5>
                <p className="text-secondary small mb-3">
                  Enregistrez les écarts de stock constatés lors des inventaires glissants (pertes, casse sur dépôt, erreurs de comptage).
                </p>

                <form onSubmit={handleSaveMouvement} className="row g-3">
                  <div className="col-12 col-md-4">
                    <label className="form-label fw-semibold">Article Concerné *</label>
                    <select
                      className="form-select"
                      value={mouvementForm.article_id}
                      onChange={e => setMouvementForm({ ...mouvementForm, article_id: Number(e.target.value) })}
                    >
                      {articles.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.reference} - {a.nom} (Stock actuel: {a.stock_actuel} {a.unite})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-3">
                    <label className="form-label fw-semibold">Type d'Ajustement *</label>
                    <select
                      className="form-select"
                      value={mouvementForm.type_mouvement}
                      onChange={e =>
                        setMouvementForm({ ...mouvementForm, type_mouvement: e.target.value as any })
                      }
                    >
                      <option value="inventaire">Entrée / Ajustement Positif</option>
                      <option value="sortie">Sortie / Casse ou Perte</option>
                    </select>
                  </div>

                  <div className="col-12 col-md-2">
                    <label className="form-label fw-semibold">Quantité Écart *</label>
                    <input
                      type="number"
                      className="form-control font-mono"
                      min={1}
                      required
                      value={mouvementForm.quantite}
                      onChange={e => setMouvementForm({ ...mouvementForm, quantite: Number(e.target.value) })}
                    />
                  </div>

                  <div className="col-12 col-md-3">
                    <label className="form-label fw-semibold">Motif / Rationale BTP *</label>
                    <select
                      className="form-select"
                      value={mouvementForm.motif_ajustement}
                      onChange={e => setMouvementForm({ ...mouvementForm, motif_ajustement: e.target.value })}
                    >
                      <option value="Erreur de comptage">Erreur de comptage inventaire</option>
                      <option value="Casse lors de la manutention">Casse lors de la manutention</option>
                      <option value="Détérioration humidité/péremption">Détérioration humidité / intempéries</option>
                      <option value="Disparition/Vol constaté">Disparition / Vol constaté</option>
                    </select>
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold">Remarques complémentaires</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="ex: Sacs de ciment ayant pris l humidité lors de l orage du 10/09"
                      value={mouvementForm.notes}
                      onChange={e => setMouvementForm({ ...mouvementForm, notes: e.target.value })}
                    />
                  </div>

                  <div className="col-12 d-flex justify-content-end">
                    <button type="submit" className="btn btn-primary fw-bold">
                      <i className="bi bi-save me-1.5"></i>Valider l'Ajustement d'Inventaire
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 8: FOURNISSEURS BTP */}
          {activeTab === 'fournisseurs' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-dark mb-0">
                  <i className="bi bi-building me-2 text-primary"></i>Répertoire des Fournisseurs Matériaux BTP
                </h5>
                {perms.canCreateArticle && (
                  <button
                    className="btn btn-primary btn-sm fw-semibold"
                    onClick={() => {
                      setFournisseurForm({})
                      setShowFournisseurModal(true)
                    }}
                  >
                    <i className="bi bi-plus-lg me-1.5"></i>Nouveau Fournisseur
                  </button>
                )}
              </div>

              <div className="row g-4">
                {fournisseurs.length === 0 ? (
                  <div className="col-12 text-center py-5 text-muted">
                    <i className="bi bi-truck fs-3 d-block mb-2"></i>
                    Aucun fournisseur enregistré pour le moment.
                  </div>
                ) : (
                  fournisseurs.map(f => (
                    <div key={f.id} className="col-12 col-md-6 col-lg-4">
                      <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <div className="p-2 bg-primary bg-opacity-10 text-primary rounded">
                              <i className="bi bi-building fs-5"></i>
                            </div>
                            <h5 className="fw-bold text-dark mb-0">{f.nom}</h5>
                          </div>
                          <p className="text-muted small mb-2">
                            <i className="bi bi-geo-alt me-1.5"></i>
                            {f.adresse || 'Antananarivo, Madagascar'}
                          </p>
                          <p className="text-muted small mb-1">
                            <i className="bi bi-telephone me-1.5"></i>
                            {f.telephone || 'Non renseigné'}
                          </p>
                          <p className="text-muted small mb-0">
                            <i className="bi bi-envelope me-1.5"></i>
                            {f.email || 'Non renseigné'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* MODALS INTERACTIVES INTELLIGENTES MAGASINIER */}
      {/* ============================================================ */}

      {/* MODAL 1: CRÉER / ÉDITER UN ARTICLE MATÉRIAU */}
      {showArticleModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-box-seam me-2 text-primary"></i>
                  {selectedArticle ? 'Éditer la Fiche Matériau' : 'Nouveau Matériau BTP en Dépôt'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowArticleModal(false)}></button>
              </div>
              <form onSubmit={handleSaveArticle}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label fw-semibold mb-0">Référence BTP (auto)</label>
                      </div>
                      <input
                        type="text"
                        className="form-control font-mono"
                        placeholder="Auto si vide (ex: ART-0001)"
                        value={articleForm.reference || ''}
                        onChange={e => setArticleForm({ ...articleForm, reference: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-8">
                      <label className="form-label fw-semibold">Désignation Matériau *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder="ex: Ciment CPJ 42.5 (Sac 50kg)"
                        value={articleForm.nom || ''}
                        onChange={e => setArticleForm({ ...articleForm, nom: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Catégorie BTP (Combobox) *</label>
                      <select
                        className="form-select"
                        value={articleForm.categorie || 'Liants & Ciments'}
                        onChange={e => {
                          const newCat = e.target.value
                          setArticleForm({
                            ...articleForm,
                            categorie: newCat,
                          })
                        }}
                      >
                        <option value="Liants & Ciments">Liants & Ciments</option>
                        <option value="Acier & Armatures">Acier & Armatures</option>
                        <option value="Granulats & VRD">Granulats & VRD</option>
                        <option value="Coffrage & Étaiement">Coffrage & Étaiement</option>
                        <option value="Tuyauterie & Plomberie">Tuyauterie & Plomberie</option>
                        <option value="Électricité & Câblage">Électricité & Câblage</option>
                        <option value="Outillage & Équipements">Outillage & Équipements</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Dépôt / Emplacement (Combobox) *</label>
                      <select
                        className="form-select font-mono"
                        value={articleForm.emplacement || (depots[0]?.nom || 'Dépôt Principal Tanjombato')}
                        onChange={e => setArticleForm({ ...articleForm, emplacement: e.target.value })}
                      >
                        {depots.map(d => (
                          <option key={d.id} value={d.nom}>
                            {d.nom} ({d.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Unité de Mesure (Combobox) *</label>
                      <select
                        className="form-select"
                        value={articleForm.unite || UNITES_BTP_SUGGESTIONS[0]}
                        onChange={e => setArticleForm({ ...articleForm, unite: e.target.value })}
                      >
                        {UNITES_BTP_SUGGESTIONS.map(u => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Stock Actuel</label>
                      <input
                        type="number"
                        className="form-control font-mono"
                        value={articleForm.stock_actuel || 0}
                        onChange={e => setArticleForm({ ...articleForm, stock_actuel: Number(e.target.value) })}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Seuil Sécurité (Mini)</label>
                      <input
                        type="number"
                        className="form-control font-mono"
                        value={articleForm.stock_mini || 10}
                        onChange={e => setArticleForm({ ...articleForm, stock_mini: Number(e.target.value) })}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Prix PUMP (MGA)</label>
                      <input
                        type="number"
                        className="form-control font-mono"
                        value={articleForm.prix_vente || 0}
                        onChange={e =>
                          setArticleForm({
                            ...articleForm,
                            prix_vente: Number(e.target.value),
                            prix_achat: Number(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold">Description / Fiche Technique</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="Spécifications techniques, normes applicables..."
                        value={articleForm.description || ''}
                        onChange={e => setArticleForm({ ...articleForm, description: e.target.value })}
                      ></textarea>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowArticleModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold">
                    Enregistrer le Matériau
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CRÉER / ÉDITER UN DÉPÔT BTP */}
      {showDepotModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-building me-2 text-primary"></i>
                  {selectedDepot ? 'Éditer le Dépôt' : 'Nouveau Dépôt / Zone BTP'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDepotModal(false)}></button>
              </div>
              <form onSubmit={handleSaveDepot}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label fw-semibold mb-0">Code Dépôt (auto)</label>
                      </div>
                      <input
                        type="text"
                        className="form-control font-mono"
                        placeholder="Auto si vide (ex: DEP-0001)"
                        value={depotForm.code || ''}
                        onChange={e => setDepotForm({ ...depotForm, code: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-8">
                      <label className="form-label fw-semibold">Nom du Dépôt / Zone *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder="ex: Dépôt Principal Tanjombato"
                        value={depotForm.nom || ''}
                        onChange={e => setDepotForm({ ...depotForm, nom: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Type de Dépôt *</label>
                      <select
                        className="form-select"
                        value={depotForm.type || 'magasin_principal'}
                        onChange={e => setDepotForm({ ...depotForm, type: e.target.value as any })}
                      >
                        <option value="magasin_principal">Magasin / Dépôt Principal</option>
                        <option value="depot_chantier">Dépôt Tampon de Chantier</option>
                        <option value="zone_exterieure">Zone Extérieure / Parc Vrac</option>
                        <option value="armoire_outillage">Armoire Sécurisée Outillage</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Superficie (m²)</label>
                      <input
                        type="number"
                        className="form-control font-mono"
                        placeholder="ex: 500"
                        value={depotForm.capacite_m2 || 500}
                        onChange={e => setDepotForm({ ...depotForm, capacite_m2: Number(e.target.value) })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Responsable du Dépôt</label>
                      <select
                        className="form-select"
                        value={depotForm.responsable || employes[0]?.nom}
                        onChange={e => setDepotForm({ ...depotForm, responsable: e.target.value })}
                      >
                        {employes.map(emp => (
                          <option key={emp.id} value={emp.nom}>
                            {emp.nom} {emp.poste ? `(${emp.poste})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Téléphone / Contact</label>
                      <input
                        type="text"
                        className="form-control font-mono"
                        placeholder="ex: +261 34 00 000 00"
                        value={depotForm.telephone || ''}
                        onChange={e => setDepotForm({ ...depotForm, telephone: e.target.value })}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold">Adresse / Localisation</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="ex: Zone Industrielle Forello, Tanjombato"
                        value={depotForm.adresse || ''}
                        onChange={e => setDepotForm({ ...depotForm, adresse: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDepotModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold">
                    Enregistrer le Dépôt
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MOUVEMENT DE STOCK / SORTIE CHANTIER INTELLIGENT */}
      {showMouvementModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-box-arrow-up-right me-2 text-primary"></i>Émission d'un Bon de Sortie Chantier
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowMouvementModal(false)}></button>
              </div>
              <form onSubmit={handleSaveMouvement}>
                <div className="modal-body p-4">
                  {/* Aperçu Matériau Sélectionné */}
                  {currentMouvementArticle && (
                    <div className="card bg-light border p-3 mb-3 rounded-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <span className="badge bg-secondary bg-opacity-10 text-secondary border me-2">
                            {currentMouvementArticle.reference}
                          </span>
                          <strong className="text-dark fs-6">{currentMouvementArticle.nom}</strong>
                          <div className="small text-muted mt-1">
                            <i className="bi bi-geo-alt me-1"></i>
                            Emplacement: <strong>{currentMouvementArticle.emplacement || 'Dépôt Principal'}</strong>
                          </div>
                        </div>
                        <div className="text-end">
                          <span className="badge bg-primary bg-opacity-10 text-primary border font-mono fs-6 px-2.5 py-1">
                            Stock Réél: {currentMouvementArticle.stock_actuel} {currentMouvementArticle.unite}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Sélectionner le Matériau (Combobox) *</label>
                      <select
                        className="form-select"
                        value={mouvementForm.article_id}
                        onChange={e => setMouvementForm({ ...mouvementForm, article_id: Number(e.target.value) })}
                      >
                        {articles.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.reference} - {a.nom} ({a.stock_actuel} {a.unite})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Quantité à Délivrer *</label>
                      <div className="input-group">
                        <input
                          type="number"
                          className="form-control font-mono fw-bold"
                          required
                          min={1}
                          max={currentMouvementArticle?.stock_actuel || 9999}
                          value={mouvementForm.quantite}
                          onChange={e => setMouvementForm({ ...mouvementForm, quantite: Number(e.target.value) })}
                        />
                        <span className="input-group-text bg-light">{currentMouvementArticle?.unite || 'unité'}</span>
                      </div>
                      {/* Raccourcis Quantité Rapides */}
                      <div className="d-flex gap-1 mt-1.5">
                        <button type="button" className="btn btn-xs btn-outline-secondary py-0 px-2" onClick={() => setMouvementForm(m => ({ ...m, quantite: 5 }))}>+5</button>
                        <button type="button" className="btn btn-xs btn-outline-secondary py-0 px-2" onClick={() => setMouvementForm(m => ({ ...m, quantite: 10 }))}>+10</button>
                        <button type="button" className="btn btn-xs btn-outline-secondary py-0 px-2" onClick={() => setMouvementForm(m => ({ ...m, quantite: 50 }))}>+50</button>
                        <button type="button" className="btn btn-xs btn-outline-primary py-0 px-2" onClick={() => setMouvementForm(m => ({ ...m, quantite: currentMouvementArticle?.stock_actuel || 1 }))}>Max disponible</button>
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Chantier Destinataire (Combobox DB) *</label>
                      <select
                        className="form-select"
                        value={mouvementForm.chantier_nom}
                        onChange={e => setMouvementForm({ ...mouvementForm, chantier_nom: e.target.value })}
                      >
                        {chantiers.map(c => (
                          <option key={c.id} value={c.nom}>
                            {c.nom}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Phase d'Ouvrage Destinataire *</label>
                      <select
                        className="form-select"
                        value={mouvementForm.phase_nom}
                        onChange={e => setMouvementForm({ ...mouvementForm, phase_nom: e.target.value })}
                      >
                        <option value="Gros Œuvre - Dalle">Gros Œuvre - Dalle</option>
                        <option value="Fondations & Longrines">Fondations & Longrines</option>
                        <option value="Second Œuvre - Cloisons">Second Œuvre - Cloisons</option>
                        <option value="Terrassement & VRD">Terrassement & VRD</option>
                        <option value="Électricité & Plomberie">Électricité & Plomberie</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Récepteur / Chauffeur / Conducteur (DB) *</label>
                      <select
                        className="form-select"
                        value={mouvementForm.recepteur_nom}
                        onChange={e => setMouvementForm({ ...mouvementForm, recepteur_nom: e.target.value })}
                      >
                        {employes.map(emp => (
                          <option key={emp.id} value={emp.nom}>
                            {emp.nom} {emp.poste ? `(${emp.poste})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Remarques & Indications</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="ex: Transposé par camion benne N° 4"
                        value={mouvementForm.notes}
                        onChange={e => setMouvementForm({ ...mouvementForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowMouvementModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold">
                    Émettre Bon de Sortie & Imprimer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ÉTIQUETTE QR CODE DÉPÔT */}
      {showQrModal && qrArticle && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content border-0 shadow text-center p-3">
              <div className="modal-header border-0 pb-0 justify-content-end">
                <button type="button" className="btn-close" onClick={() => setShowQrModal(false)}></button>
              </div>
              <div className="modal-body pt-0">
                <div className="badge bg-primary bg-opacity-10 text-primary border mb-2 px-2 py-1">
                  Étiquette Emplacement Magasin
                </div>
                <h6 className="fw-bold text-dark mb-1">{qrArticle.nom}</h6>
                <p className="font-mono text-muted small mb-3">{qrArticle.reference}</p>

                {/* Simulated QR code box */}
                <div className="bg-light p-3 rounded-3 border d-inline-block mb-3">
                  <div
                    className="d-flex align-items-center justify-content-center bg-white border p-3 rounded"
                    style={{ width: '150px', height: '150px', margin: '0 auto' }}
                  >
                    <i className="bi bi-qr-code fs-1 text-dark"></i>
                  </div>
                  <small className="font-mono d-block mt-2 text-muted fs-8">
                    EMP: {qrArticle.emplacement || 'DEPOT-MAIN'}
                  </small>
                </div>

                <p className="small text-secondary mb-0">
                  Scannez ce code pour enregistrer instantanément une entrée/sortie sur terminal terrain.
                </p>
              </div>
              <div className="modal-footer border-0 justify-content-center pt-0">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => window.print()}>
                  <i className="bi bi-printer me-1"></i>Imprimer Étiquette
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: BON DE SORTIE IMPRIMABLE */}
      {showPrintBonModal && selectedBonSortie && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom bg-light">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-file-earmark-text me-2 text-primary"></i>
                  {selectedBonSortie.numero_bon} - Bon de Sortie Matériaux
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowPrintBonModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="border rounded p-3 bg-white mb-3">
                  <div className="d-flex justify-content-between align-items-start mb-3 pb-2 border-bottom">
                    <div>
                      <h6 className="fw-bold mb-0 text-dark">TIA INFO BUILD - LOGISTIQUE</h6>
                      <small className="text-muted">Bon de Sortie & Émargement Matériaux</small>
                    </div>
                    <span className="badge bg-primary bg-opacity-10 text-primary border font-mono">
                      {selectedBonSortie.date_sortie}
                    </span>
                  </div>

                  <div className="row g-2 mb-3 small">
                    <div className="col-6">
                      <span className="text-muted d-block">Chantier :</span>
                      <strong className="text-dark">{selectedBonSortie.chantier_nom}</strong>
                    </div>
                    <div className="col-6">
                      <span className="text-muted d-block">Récepteur :</span>
                      <strong className="text-dark">{selectedBonSortie.recepteur_nom}</strong>
                    </div>
                  </div>

                  <table className="table table-bordered table-sm mb-3">
                    <thead className="table-light">
                      <tr>
                        <th>Désignation Matériau</th>
                        <th className="text-end">Quantité</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="fw-semibold text-dark">{selectedBonSortie.article_nom}</td>
                        <td className="font-mono text-end fw-bold">
                          {selectedBonSortie.quantite} {selectedBonSortie.unite}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="d-flex justify-content-between align-items-center pt-2">
                    <div className="text-center">
                      <small className="text-muted d-block fs-8 mb-1">Code Traçabilité</small>
                      <i className="bi bi-qr-code fs-3 text-secondary"></i>
                    </div>
                    <div className="text-end">
                      <small className="text-muted d-block fs-8 mb-4">Visa Magasinier / Signature</small>
                      <span className="border-bottom border-secondary d-inline-block" style={{ width: '120px' }}></span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-top bg-light">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPrintBonModal(false)}>
                  Fermer
                </button>
                <button type="button" className="btn btn-primary fw-bold" onClick={() => window.print()}>
                  <i className="bi bi-printer me-1.5"></i>Imprimer Bon d'Émargement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: DÉCLARER UN PRÊT D'OUTILLAGE INTELLIGENT */}
      {showEmpruntModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-tools me-2 text-primary"></i>Déclaration d'Emprunt d'Outillage
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowEmpruntModal(false)}></button>
              </div>
              <form onSubmit={handleSaveEmprunt}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Outillage Sélectionné (Combobox) *</label>
                    <select
                      className="form-select"
                      value={empruntForm.outillage_nom}
                      onChange={e => {
                        const selectedName = e.target.value
                        const match = articles.find(a => a.nom === selectedName)
                        setEmpruntForm({
                          ...empruntForm,
                          outillage_nom: selectedName,
                          code_outil: match ? match.reference : generateCodeOutil(),
                        })
                      }}
                    >
                      {outillagesMagasin.map(o => (
                        <option key={o.id} value={o.nom}>
                          {o.reference} - {o.nom}
                        </option>
                      ))}
                      {outillagesMagasin.length === 0 && (
                        <>
                          <option value="Bétonnière Électrique 350L Pro">EQP-BET-01 - Bétonnière Électrique 350L Pro</option>
                          <option value="Perforeuse SDS-Max 1500W">OUT-PERF-MAX - Perforeuse SDS-Max 1500W</option>
                          <option value="Niveau Laser Rotatif Extérieur">EQP-LAS-03 - Niveau Laser Rotatif Extérieur</option>
                          <option value="Vibreur à Béton Thermique Ø45mm">EQP-VIB-02 - Vibreur à Béton Thermique Ø45mm</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label fw-semibold mb-0">Code / Immatriculation Outil</label>
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-decoration-none fs-8"
                        onClick={() => setEmpruntForm({ ...empruntForm, code_outil: generateCodeOutil() })}
                      >
                        <i className="bi bi-arrow-clockwise me-1"></i>Auto
                      </button>
                    </div>
                    <input
                      type="text"
                      className="form-control font-mono"
                      value={empruntForm.code_outil}
                      onChange={e => setEmpruntForm({ ...empruntForm, code_outil: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Nom de l'Emprunteur (Combobox DB) *</label>
                    <select
                      className="form-select"
                      value={empruntForm.emprunteur_nom}
                      onChange={e => setEmpruntForm({ ...empruntForm, emprunteur_nom: e.target.value })}
                    >
                      {employes.map(emp => (
                        <option key={emp.id} value={emp.nom}>
                          {emp.nom} {emp.poste ? `(${emp.poste})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Chantier Destination (Combobox DB) *</label>
                    <select
                      className="form-select"
                      value={empruntForm.chantier_nom}
                      onChange={e => setEmpruntForm({ ...empruntForm, chantier_nom: e.target.value })}
                    >
                      {chantiers.map(c => (
                        <option key={c.id} value={c.nom}>
                          {c.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Date de Retour Prévue *</label>
                    <input
                      type="date"
                      className="form-control font-mono"
                      required
                      value={empruntForm.date_retour_prevue}
                      onChange={e => setEmpruntForm({ ...empruntForm, date_retour_prevue: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer border-top bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEmpruntModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold">
                    Valider le Prêt
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: ENREGISTRER UNE RÉCEPTION FOURNISSEUR INTELLIGENTE */}
      {showReceptionModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-clipboard-check me-2 text-primary"></i>Enregistrer une Réception Fournisseur
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowReceptionModal(false)}></button>
              </div>
              <form onSubmit={handleSaveReception}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label fw-semibold mb-0">N° Bon de Livraison (BL) *</label>
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-decoration-none fs-8"
                        onClick={() => setReceptionForm({ ...receptionForm, numero_bl: generateNumeroBL() })}
                      >
                        <i className="bi bi-arrow-clockwise me-1"></i>Générer Auto
                      </button>
                    </div>
                    <input
                      type="text"
                      className="form-control font-mono"
                      placeholder="Auto si vide (ex: BL-2026-0955)"
                      value={receptionForm.numero_bl}
                      onChange={e => setReceptionForm({ ...receptionForm, numero_bl: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Fournisseur BTP (Combobox DB) *</label>
                    <select
                      className="form-select"
                      value={receptionForm.fournisseur_nom}
                      onChange={e => setReceptionForm({ ...receptionForm, fournisseur_nom: e.target.value })}
                    >
                      {fournisseurs.map(f => (
                        <option key={f.id} value={f.nom}>
                          {f.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Matériau Livré (Combobox DB) *</label>
                    <select
                      className="form-select"
                      value={receptionForm.article_nom}
                      onChange={e => {
                        const targetName = e.target.value
                        const match = articles.find(a => a.nom === targetName)
                        setReceptionForm({
                          ...receptionForm,
                          article_nom: targetName,
                          unite: match ? match.unite : receptionForm.unite,
                        })
                      }}
                    >
                      {articles.map(a => (
                        <option key={a.id} value={a.nom}>
                          {a.reference} - {a.nom} ({a.unite})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-8">
                      <label className="form-label fw-semibold">Quantité Livrée *</label>
                      <input
                        type="number"
                        className="form-control font-mono fw-bold"
                        required
                        min={1}
                        value={receptionForm.quantite_livree}
                        onChange={e => setReceptionForm({ ...receptionForm, quantite_livree: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label fw-semibold">Unité *</label>
                      <select
                        className="form-select"
                        value={receptionForm.unite}
                        onChange={e => setReceptionForm({ ...receptionForm, unite: e.target.value })}
                      >
                        {UNITES_BTP_SUGGESTIONS.map(u => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">État / Conformité de la Livraison *</label>
                    <select
                      className="form-select"
                      value={receptionForm.etat_livraison}
                      onChange={e => setReceptionForm({ ...receptionForm, etat_livraison: e.target.value as any })}
                    >
                      <option value="conforme">Conforme (Aucune anomalie)</option>
                      <option value="reserve">Avec Réserves (Sac abîmé, légère rouille...)</option>
                      <option value="refuse">Refusé (Marchandise non conforme / retour)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Observations</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="ex: Vérification effectuée sur palette de déchargement"
                      value={receptionForm.notes}
                      onChange={e => setReceptionForm({ ...receptionForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer border-top bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowReceptionModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold">
                    Valider la Réception & Incrémenter Stock
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: CRÉER UN FOURNISSEUR */}
      {showFournisseurModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'var(--overlay)' }}>
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-shop me-2 text-primary"></i>Nouveau Fournisseur BTP
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowFournisseurModal(false)}></button>
              </div>
              <form onSubmit={handleSaveFournisseur}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Nom de l'Entreprise / Fournisseur *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="ex: Cimenterie de Madagascar"
                      value={fournisseurForm.nom || ''}
                      onChange={e => setFournisseurForm({ ...fournisseurForm, nom: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Téléphone Contact</label>
                    <input
                      type="text"
                      className="form-control font-mono"
                      placeholder="ex: +261 34 00 000 00"
                      value={fournisseurForm.telephone || ''}
                      onChange={e => setFournisseurForm({ ...fournisseurForm, telephone: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Email Contact</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="ex: commercial@cimenterie.mg"
                      value={fournisseurForm.email || ''}
                      onChange={e => setFournisseurForm({ ...fournisseurForm, email: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Adresse / Ville</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="ex: Zone Industrielle Forello, Tanjombato, Antananarivo"
                      value={fournisseurForm.adresse || ''}
                      onChange={e => setFournisseurForm({ ...fournisseurForm, adresse: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer border-top bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowFournisseurModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold">
                    Enregistrer le Fournisseur
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
