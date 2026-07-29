package com.tiaInfo.build;

import java.net.URL;

import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import javafx.application.Application;
import javafx.fxml.FXMLLoader;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.stage.Stage;

/**
 * Point d'entree JavaFX. Demarre Spring Boot en interne (contexte
 * "embarque", sans serveur web) puis affiche la fenetre principale
 * chargee depuis un FXML dont le controleur est resolu par Spring
 * (injection possible via @Autowired dans les controleurs).
 */
public class JavaFxApp extends Application {

    private ConfigurableApplicationContext springContext;

    @Override
    public void init() {
        springContext = new SpringApplicationBuilder(BuildApplication.class)
                .web(WebApplicationType.NONE)
                .headless(false)
                .run(getParameters().getRaw().toArray(new String[0]));
    }

    @Override
    public void start(Stage primaryStage) throws Exception {
        FXMLLoader loader = new FXMLLoader();
        // permet aux controleurs FXML d'etre des beans Spring (@Autowired possible)
        loader.setControllerFactory(springContext::getBean);

        URL fxmlUrl = getClass().getResource("/fxml/main-view.fxml");
        loader.setLocation(fxmlUrl);
        Parent root = loader.load();

        Scene scene = new Scene(root, 1024, 700);
        URL cssUrl = getClass().getResource("/css/style.css");
        if (cssUrl != null) {
            scene.getStylesheets().add(cssUrl.toExternalForm());
        }

        primaryStage.setTitle("TIA INFO BUILD");
        primaryStage.setScene(scene);
        primaryStage.show();
    }

    @Override
    public void stop() {
        springContext.close();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
