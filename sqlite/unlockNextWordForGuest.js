import * as SQLite from 'expo-sqlite';

const unlockNextWordForGuest = async (currentWordId) => {
    try {
        const db = await SQLite.openDatabaseAsync('wordsDatabase.sqlite');

        // get the current word
        const currentWord = await db.getFirstAsync(
            `SELECT *
             FROM words
             WHERE id = ?`, currentWordId
        );

        // if the word is already complete, return
        if (currentWord.completed === 1) {
            return;
        }

        // mark the current word as complete
        await db.runAsync(
            `UPDATE words
             SET completed = 1
             WHERE id = ?`, currentWordId
        );

        // unlock the next word
        const nextWord = await db.getFirstAsync(
            `SELECT *
             FROM words
             WHERE position > ?
             AND unlocked = 0`, currentWordId
        );

        // mark the next word as unlocked
        if (nextWord) {
            await db.runAsync(
                `UPDATE words
                 SET unlocked = 1
                 WHERE id = ?`, nextWord.id
            );
        }

        await db.closeAsync();
        return nextWord;
    } catch (error) {
        console.error('Error unlocking the next word or completing the current word:', error);
        return null;
    }
}

export default unlockNextWordForGuest;