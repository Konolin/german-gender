import * as SQLite from 'expo-sqlite';
import wordsData from "../data/wordsData";

const createTablesIfNotExisting = async (db) => {
    try {
        await db.execAsync('PRAGMA foreign_keys = ON;');
        await db.execAsync(
            `
                CREATE TABLE IF NOT EXISTS sentences
                (
                    id      INTEGER PRIMARY KEY AUTOINCREMENT,
                    german  TEXT,
                    english TEXT
                );
                CREATE TABLE IF NOT EXISTS words
                (
                    id          TEXT PRIMARY KEY,
                    completed   BOOLEAN,
                    english     TEXT,
                    german      TEXT,
                    position    INTEGER,
                    score       INTEGER,
                    sentence_id INTEGER,
                    subtype     TEXT,
                    type        TEXT,
                    article     TEXT,
                    unlocked    BOOLEAN,
                    FOREIGN KEY (sentence_id) REFERENCES sentences (id)
                );
                CREATE TABLE IF NOT EXISTS forms
                (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    word_id     TEXT, -- the word this form belongs to
                    form        TEXT,
                    explanation TEXT,
                    FOREIGN KEY (word_id) REFERENCES words (id)
                );`
        );
        // console.log('Tables created');
    } catch (error) {
        console.error('Error creating tables:', error);
    }
};

const insertWords = async (db) => {
    try {
        for (const [type, words] of Object.entries(wordsData)) {
            for (const word of words) {
                const index = words.indexOf(word);
                const article = word.article || 'noart';
                const wordId = type + '-' + article + '-' + word.german.toLowerCase();

                const sentence = word.sentence;
                const result = await db.runAsync(
                    `INSERT INTO sentences (german, english) VALUES (?, ?);`,
                    [sentence.german, sentence.english]
                );

                const sentenceId = result.lastInsertRowId;

                await db.runAsync(
                    `INSERT INTO words (id, completed, english, german, position, score, sentence_id, subtype, type, article, unlocked)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                    [wordId, false, word.english, word.german, index, 0, sentenceId, word.subtype, type, word.article, index < 4]
                );

                const forms = word.forms;
                if (forms) {
                    for (const formObj of forms) {
                        const {form, explanation} = formObj;
                        await db.runAsync(
                            `INSERT INTO forms (word_id, form, explanation) VALUES (?, ?, ?);`,
                            [wordId, form, explanation]
                        );
                    }
                }
            }
        }
        console.log('Words inserted');
    } catch (error) {
        console.error('Error inserting words:', error);
    }
};

const dropTables = async (db) => {
    await db.runAsync(`DROP TABLE IF EXISTS forms;`);
    await db.runAsync(`DROP TABLE IF EXISTS words;`);
    await db.runAsync(`DROP TABLE IF EXISTS sentences;`);
    console.log('Tables dropped');
};

const initLocalDb = async () => {
    try {
        const db = await SQLite.openDatabaseAsync('wordsDatabase.sqlite');
        if (!db) {
            throw new Error('Failed to open database');
        }
        await createTablesIfNotExisting(db);

        const wordsCount = await db.getFirstAsync(`SELECT COUNT(*) as count FROM words`);
        if (wordsCount.count === 0) {
            await insertWords(db);
        }
        await db.closeAsync();
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

export default initLocalDb;
