"""
Vues du module Stocks.
"""

from django.contrib import messages
from django.db.models import F
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DeleteView

from core.views import EntrepriseRequiredMixin
from .models import Article, Fournisseur, MouvementStock
from .forms import ArticleForm, FournisseurForm, MouvementStockForm


class ArticleListView(EntrepriseRequiredMixin, ListView):
    model = Article
    template_name = "stocks/article_list.html"
    context_object_name = "articles"
    paginate_by = 15

    def get_queryset(self):
        return Article.objects.filter(entreprise=self.request.entreprise).order_by("nom")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["articles_en_alerte"] = self.get_queryset().filter(
            quantite_stock__lte=F("seuil_alerte")
        ).count()
        return ctx


class ArticleCreateView(EntrepriseRequiredMixin, CreateView):
    model = Article
    form_class = ArticleForm
    template_name = "stocks/article_form.html"
    success_url = reverse_lazy("stocks:article_liste")

    def form_valid(self, form):
        form.instance.entreprise = self.request.entreprise
        messages.success(self.request, f"L'article {form.instance.nom} a été créé.")
        return super().form_valid(form)


class ArticleUpdateView(EntrepriseRequiredMixin, UpdateView):
    model = Article
    form_class = ArticleForm
    template_name = "stocks/article_form.html"
    success_url = reverse_lazy("stocks:article_liste")

    def get_queryset(self):
        return Article.objects.filter(entreprise=self.request.entreprise)

    def form_valid(self, form):
        messages.success(self.request, f"L'article {form.instance.nom} a été mis à jour.")
        return super().form_valid(form)


class FournisseurListView(EntrepriseRequiredMixin, ListView):
    model = Fournisseur
    template_name = "stocks/fournisseur_list.html"
    context_object_name = "fournisseurs"
    paginate_by = 15

    def get_queryset(self):
        return Fournisseur.objects.filter(entreprise=self.request.entreprise).order_by("nom")


class FournisseurCreateView(EntrepriseRequiredMixin, CreateView):
    model = Fournisseur
    form_class = FournisseurForm
    template_name = "stocks/fournisseur_form.html"
    success_url = reverse_lazy("stocks:fournisseur_liste")

    def form_valid(self, form):
        form.instance.entreprise = self.request.entreprise
        messages.success(self.request, f"Le fournisseur {form.instance.nom} a été créé.")
        return super().form_valid(form)


class MouvementStockListView(EntrepriseRequiredMixin, ListView):
    model = MouvementStock
    template_name = "stocks/mouvement_list.html"
    context_object_name = "mouvements"
    paginate_by = 20

    def get_queryset(self):
        return MouvementStock.objects.filter(
            article__entreprise=self.request.entreprise
        ).select_related("article", "chantier", "fournisseur").order_by("-date_mouvement")


class MouvementStockCreateView(EntrepriseRequiredMixin, CreateView):
    model = MouvementStock
    form_class = MouvementStockForm
    template_name = "stocks/mouvement_form.html"
    success_url = reverse_lazy("stocks:mouvement_liste")

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["user"] = self.request.user
        return kwargs

    def form_valid(self, form):
        mouvement = form.save(commit=False)
        article = mouvement.article
        # Vérifier que l'article appartient à l'entreprise
        if article.entreprise != self.request.entreprise:
            messages.error(self.request, "Cet article n'appartient pas à votre entreprise.")
            return self.form_invalid(form)
        # Mettre à jour le stock
        if mouvement.type_mouvement == "entree":
            article.quantite_stock = F("quantite_stock") + mouvement.quantite
        else:
            article.quantite_stock = F("quantite_stock") - mouvement.quantite
        article.save()
        article.refresh_from_db()
        messages.success(self.request, f"Le mouvement de stock a été enregistré. Stock : {article.quantite_stock} {article.unite}.")
        return super().form_valid(form)
