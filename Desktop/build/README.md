# TIA INFO BUILD — Desktop (JavaFX + Spring Boot embarque)

Application desktop JavaFX (FXML + CSS) avec un contexte Spring Boot
embarque (sans serveur web) et une base de donnees H2 fichier locale.

## Stack

- Java 21
- Spring Boot 4.1.0 (Data JPA, Security)
- JavaFX 21 (Controls + FXML)
- Base de donnees H2 (fichier local, embarquee, sans serveur externe)

## Structure du projet

```
src/main/java/com/tiaInfo/build/
├── BuildApplication.java     # Config Spring Boot (@SpringBootApplication)
├── Launcher.java             # Point d'entree du jar packaged (voir plus bas)
├── JavaFxApp.java            # Point d'entree JavaFX, demarre Spring + affiche la fenetre
├── domain/
│   ├── Chantier.java             # Entite JPA de demonstration
│   └── ChantierRepository.java   # Repository Spring Data JPA
└── ui/
    └── MainController.java   # Controleur FXML (bean Spring, @Autowired possible)

src/main/resources/
├── application.properties    # Config Spring Boot + datasource H2
├── fxml/main-view.fxml       # Vue principale
└── css/style.css             # Style de l'app
```

## Lancer l'application

### En developpement

```bash
mvn javafx:run
```

La fenetre JavaFX s'ouvre directement, le contexte Spring (JPA/H2)
est demarre avant l'affichage de l'IHM (dans `JavaFxApp.init()`).

### En jar executable

```bash
mvn clean package
java -jar target/build-0.0.1-SNAPSHOT.jar
```

> Le `Main-Class` du jar packaged est `Launcher` (classe neutre) et
> non `JavaFxApp` directement : si le `Main-Class` du manifest etend
> `javafx.application.Application`, `java -jar` echoue avec
> `Error: JavaFX runtime components are missing`. `Launcher` contourne
> ce probleme en appelant `JavaFxApp.main(args)`.

## Base de donnees H2

La base est un fichier local (pas de serveur H2 a lancer separement) :

```
~/.tia-info-build/data/tiadb.mv.db
```

Configuration dans `application.properties` :

```properties
spring.datasource.url=jdbc:h2:file:${user.home}/.tia-info-build/data/tiadb;AUTO_SERVER=TRUE
spring.jpa.hibernate.ddl-auto=update
```

- `AUTO_SERVER=TRUE` autorise plusieurs connexions concurrentes sur le
  meme fichier (utile en dev, ou si l'app est relancee sans avoir
  ferme proprement la precedente instance).
- `ddl-auto=update` : le schema est cree/mis a jour automatiquement a
  partir des entites JPA. A remplacer par une migration (Flyway/Liquibase)
  avant la mise en production.

Une entite de demonstration (`Chantier`) et son repository sont deja
en place pour verifier que la persistance fonctionne : le bouton
"Demarrer" de l'IHM insere une ligne et affiche le total enregistre.

## Points a completer ensuite

- Remplacer l'entite `Chantier` de demo par le vrai modele de donnees
  (chantiers, RH, materiel, stocks, commercial, finance).
- Ajouter les vues/controleurs FXML supplementaires au fur et a mesure
  des modules.
- Prevoir la synchronisation avec le backend en ligne (mode hors-ligne
  sur chantier + sync ulterieure).
- Pour distribuer un executable natif (Windows/Mac/Linux), envisager
  `jpackage` ou `jlink` avec les classifiers JavaFX correspondants.
