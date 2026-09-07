from sqlalchemy import create_engine, text

engine = create_engine('mysql+pymysql://root:@localhost:3306/tia_build_db')
with engine.connect() as conn:
    print("=== Employes ===")
    for row in conn.execute(text("SELECT id, nom, prenom, email FROM employes WHERE is_deleted=0")):
        print("  ", tuple(row))
    print("=== Chantiers ===")
    for row in conn.execute(text("SELECT id, nom, statut FROM chantiers WHERE is_deleted=0")):
        print("  ", tuple(row))
    print("=== Affectations ===")
    for row in conn.execute(text("SELECT id, employe_id, chantier_id, role FROM affectation_chantiers WHERE is_deleted=0")):
        print("  ", tuple(row))
    print("=== Taches ===")
    for row in conn.execute(text("SELECT id, titre, employe_id, chantier_id, statut FROM taches WHERE is_deleted=0")):
        print("  ", tuple(row))