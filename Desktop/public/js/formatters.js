/**
 * Utility JS - Formateur dynamique de devises pour vues Electron HTML5
 */
(function (window) {
    'use strict';

    let currentDevise = '€';

    /**
     * Configurer la devise active pour l'application
     * @param {string} symbol - Symbole monétaire (ex: '€', 'FCFA', 'Ar', '$', 'DH')
     */
    function setDevise(symbol) {
        if (symbol && typeof symbol === 'string') {
            currentDevise = symbol.trim();
            updateDOMCurrencySymbols();
        }
    }

    /**
     * Récupérer le symbole de la devise active
     */
    function getDevise() {
        return currentDevise;
    }

    /**
     * Mettre à jour automatiquement les éléments HTML portant la classe CSS .currency-symbol
     */
    function updateDOMCurrencySymbols() {
        document.querySelectorAll('.currency-symbol').forEach(element => {
            element.textContent = currentDevise;
        });
    }

    /**
     * Formater un montant numérique avec la devise configurée
     * @param {number|string} amount - Montant brut
     * @param {string|null} overrideDevise - Devise spécifique optionnelle
     * @returns {string} - Montant formaté (ex: "1 250,00 €" ou "1.250.000 FCFA")
     */
    function formatMontant(amount, overrideDevise = null) {
        const num = parseFloat(amount) || 0;
        const devise = overrideDevise || currentDevise;

        const formatted = new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);

        return `${formatted} ${devise}`;
    }

    /**
     * Formater dynamiquement tous les éléments HTML possédant l'attribut `data-amount`
     */
    function formatAllDataAmountElements() {
        document.querySelectorAll('[data-amount]').forEach(element => {
            const rawValue = element.getAttribute('data-amount');
            element.textContent = formatMontant(rawValue);
        });
    }

    // Exposer l'objet global dans window
    window.CurrencyFormatter = {
        setDevise,
        getDevise,
        formatMontant,
        updateDOMCurrencySymbols,
        formatAllDataAmountElements
    };

    // Auto-exécution au chargement du DOM
    document.addEventListener('DOMContentLoaded', () => {
        updateDOMCurrencySymbols();
        formatAllDataAmountElements();
    });

})(window);