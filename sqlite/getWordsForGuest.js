import * as SQLite from "expo-sqlite";

export const getAllWordsForGuest = async () => {
    try {
        const db = await SQLite.openDatabaseAsync('wordsDatabase.sqlite');

        // Fetch all words
        const words = await db.getAllAsync(`SELECT * FROM words`);

        // Prepare the result object
        const wordsByType = {};

        // Process each word
        for (const word of words) {
            // Fetch all forms for the word
            const forms = await db.getAllAsync(
                `SELECT * FROM forms WHERE word_id = ?`,
                [word.id]
            );

            // Remove unnecessary fields from forms
            if (forms) {
                for (const form of forms) {
                    delete form.word_id;
                    delete form.id;
                }
            }
            word.forms = forms;

            // Fetch the sentence for the word
            const sentence = await db.getFirstAsync(
                `SELECT * FROM sentences WHERE id = ?`,
                [word.sentence_id]
            );

            // Remove unnecessary fields and add sentence to the word
            if (sentence) {
                delete sentence.id;
                word.sentence = sentence;
            }
            delete word.sentence_id;

            // Group words by type
            if (!wordsByType[word.type]) {
                wordsByType[word.type] = [];
            }
            wordsByType[word.type].push(word);
        }

        await db.closeAsync();
        console.log('Words fetched for guest successfully');
        return wordsByType;
    } catch (error) {
        console.error('Error getting words for guest:', error);
        return null;
    }
};