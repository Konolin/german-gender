import * as SQLite from 'expo-sqlite';

const updateWordScoreForGuest = async (wordId, newScore) => {
    try {
        const db = await SQLite.openDatabaseAsync('wordsDatabase.sqlite');
        await db.runAsync(`UPDATE words SET score = ? WHERE id = ?`, newScore, wordId);
        await db.closeAsync();
    } catch (error) {
        console.error(error);
    }
}

export default updateWordScoreForGuest;