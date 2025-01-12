import * as SQLite from 'expo-sqlite';

export const getUnlockedWordsForGuest = async () => {
    try {
        const db = await SQLite.openDatabaseAsync('wordsDatabase.sqlite');

        // Fetch all words
        const words = await db.getAllAsync(`SELECT * FROM words WHERE unlocked = 1`);

        // Prepare the result object
        const unlockedWordsByType = {};

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
            if (!unlockedWordsByType[word.type]) {
                unlockedWordsByType[word.type] = [];
            }
            unlockedWordsByType[word.type].push(word);
        }

        await db.closeAsync();
        console.log('Unlocked words fetched for guest successfully');
        return unlockedWordsByType;
    } catch (error) {
        console.error('Error getting unlocked words for guest:', error);
        return null;
    }
}