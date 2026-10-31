from database import SessionLocal, engine
from models import Base, Gender, ParentChild, Person

# Пересоздаем таблицы
Base.metadata.create_all(bind=engine)


def seed_data():
    db = SessionLocal()

    # Очистка старых данных
    db.query(ParentChild).delete()
    db.query(Person).delete()
    db.commit()

    # 1. Поколение 1 (дедушка и бабушка)
    p1 = Person(
        first_name="Иван",
        given_name="Иоанн",
        last_name="Иванов",
        patronymic="Сидорович",
        aliases="Ваня-Кузнец",
        gender=Gender.MALE,
        is_alive=False,
        birth_date="12.05.1945",
        birth_place="дер. Ивановка, Орловская область",
        death_date="20.01.2018",
        death_place="г. Москва",
        death_cause="Естественные причины",
        cemetery_name="Троекуровское кладбище",
        cemetery_plot="Участок 4B",
        occupations="Инженер-конструктор (1968–2010)",
        education="МГТУ им. Н.Э. Баумана",
        social_status="Рабочий / Интеллигенция",
        military_is_served=True,
        military_regiment="Связист",
        military_rank="Сержант",
        military_awards="Орден Почета",
        religion="Православие",
        residences="г. Москва, ул. Арбат, д. 12 (1970–2018)",
        biography="Увлекался радиоэлектроникой, посвятил жизнь работе на заводе."
    )

    p2 = Person(
        first_name="Анна",
        last_name="Иванова",
        patronymic="Петровна",
        maiden_name="Смирнова",
        gender=Gender.FEMALE,
        is_alive=False,
        birth_date="около 1948",
        birth_place="г. Тула",
        death_date="15.03.2021",
        death_place="г. Москва",
        cemetery_name="Троекуровское кладбище",
        occupations="Учитель математики (1970–2005)",
        education="МПГУ",
        biography="Преподавала в средней школе более 35 лет."
    )

    # 2. Поколение 2 (родители)
    p3 = Person(
        first_name="Алексей",
        last_name="Иванов",
        patronymic="Иванович",
        gender=Gender.MALE,
        is_alive=True,
        birth_date="15.03.1975",
        birth_place="г. Москва",
        occupations="Архитектор (2000–н.в.)",
        education="МАРХИ",
        military_is_served=False,
        residences="г. Москва, Ленинский проспект",
        biography="Проектирует жилые комплексы и общественные пространства."
    )

    p4 = Person(
        first_name="Мария",
        last_name="Иванова",
        patronymic="Сергеевна",
        maiden_name="Петрова",
        gender=Gender.FEMALE,
        is_alive=True,
        birth_date="05.11.1978",
        birth_place="г. Санкт-Петербург",
        occupations="Врач-кардиолог",
        education="Первый МГМУ им. И.М. Сеченова",
        biography="Заведующая отделением кардиохирургии."
    )

    # 3. Поколение 3 (дети)
    p5 = Person(
        first_name="Дмитрий",
        last_name="Иванов",
        patronymic="Алексеевич",
        gender=Gender.MALE,
        is_alive=True,
        birth_date="10.01.2002",
        birth_place="г. Москва",
        occupations="Программист",
        education="НИУ ВШЭ",
        biography="Занимается веб-разработкой и исследованием графовых баз данных."
    )

    p6 = Person(
        first_name="Елена",
        last_name="Иванова",
        patronymic="Алексеевна",
        gender=Gender.FEMALE,
        is_alive=True,
        birth_date="25.07.2006",
        birth_place="г. Москва",
        education="Школа №1543",
        biography="Увлекается живописью и графическим дизайном."
    )

    db.add_all([p1, p2, p3, p4, p5, p6])
    db.commit()

    # Создание связей родитель -> ребенок
    relations = [
        ParentChild(parent_id=p1.id, child_id=p3.id),  # Иван -> Алексей
        ParentChild(parent_id=p2.id, child_id=p3.id),  # Анна -> Алексей
        ParentChild(parent_id=p3.id, child_id=p5.id),  # Алексей -> Дмитрий
        ParentChild(parent_id=p3.id, child_id=p6.id),  # Алексей -> Елена
        ParentChild(parent_id=p4.id, child_id=p5.id),  # Мария -> Дмитрий
        ParentChild(parent_id=p4.id, child_id=p6.id),  # Мария -> Елена
    ]

    db.add_all(relations)
    db.commit()
    db.close()
    print("Тестовое дерево с расширенными атрибутами успешно заполнено!")


if __name__ == "__main__":
    seed_data()