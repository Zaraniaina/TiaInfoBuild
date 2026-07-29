package com.tiaInfo.build;

/**
 * Point d'entree neutre utilise par le jar Spring Boot packaged.
 * Ne pas remplacer par JavaFxApp directement : si le Main-Class du
 * manifest etend javafx.application.Application, "java -jar build.jar"
 * echoue avec "Error: JavaFX runtime components are missing".
 */
public class Launcher {

    public static void main(String[] args) {
        JavaFxApp.main(args);
    }
}
