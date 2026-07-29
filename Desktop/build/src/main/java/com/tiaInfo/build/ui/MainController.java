package com.tiaInfo.build.ui;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.tiaInfo.build.domain.Chantier;
import com.tiaInfo.build.domain.ChantierRepository;

import javafx.fxml.FXML;
import javafx.scene.control.Label;

/**
 * Controleur de la vue principale. Annote @Component pour etre
 * instancie par le contexte Spring (cf. loader.setControllerFactory
 * dans JavaFxApp) : on peut donc y injecter n'importe quel service
 * ou repository Spring avec @Autowired.
 */
@Component
public class MainController {

    @Autowired
    private ChantierRepository chantierRepository;

    @FXML
    private Label welcomeLabel;

    @FXML
    public void initialize() {
        long total = chantierRepository.count();
        welcomeLabel.setText("Bienvenue sur TIA INFO BUILD (" + total + " chantier(s) en base H2)");
    }

    @FXML
    private void onStartClick() {
        // Demo : insertion en base H2 pour verifier que la persistance fonctionne
        Chantier chantier = chantierRepository.save(new Chantier("Chantier de test"));
        long total = chantierRepository.count();
        welcomeLabel.setText("Chantier #" + chantier.getId() + " enregistre - total : " + total);
    }
}
