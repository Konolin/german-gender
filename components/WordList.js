import React, {useState, useEffect, useContext} from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text } from 'react-native';
import {getAllWordsForUser} from '../firebase/getAllWords';
import colors from '../styles/colors';
import Flashcard from './Flashcard';
import WordListHeader from './WordListHeader';
import {UserContext} from "../context/UserContext";
import {getAllWordsForGuest} from "../sqlite/getWordsForGuest";

// Define the predefined order
const predefinedOrder = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition'];

const WordList = ({ setComponent }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [allWords, setAllWords] = useState([]);
    const [selectedType, setSelectedType] = useState('noun');
    const [availableTypes, setAvailableTypes] = useState(predefinedOrder); // Initialize with predefined order
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { currentUserId } = useContext(UserContext);

    useEffect(() => {
        const loadWords = async () => {
            setLoading(true);
            setError(null);
            try {
                const wordsByType = currentUserId
                    ? await getAllWordsForUser(currentUserId)
                    : await getAllWordsForGuest();

                // Flatten the wordsByType object into a single array
                const flatWords = Object.entries(wordsByType).flatMap(([type, words]) =>
                    words.map(word => ({ ...word, type }))
                );

                setAllWords(flatWords);
            } catch (error) {
                console.error('Failed to load words:', error);
                setError('Failed to load words. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        loadWords();
    }, []);

    // Filter words based on type and search query
    const filteredWords = allWords.filter(word =>
        (selectedType === null || word.type === selectedType) &&
        (word.german.toLowerCase().includes(searchQuery.toLowerCase()) ||
            word.english.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Find the first locked word for each type
    const firstLockedByType = {};
    filteredWords.forEach((word, index) => {
        if (word.score === null && !(word.type in firstLockedByType)) {
            firstLockedByType[word.type] = index;
        }
    });

    // Render flashcards with the `firstLocked` prop
    const renderItem = ({ item, index }) => (
        <Flashcard item={item} firstLocked={firstLockedByType[item.type] === index} />
    );

    if (error) {
        return (
            <View style={styles.container}>
                <WordListHeader
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedType={selectedType}
                    setSelectedType={setSelectedType}
                    setComponent={setComponent}
                    availableTypes={availableTypes}
                />
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <WordListHeader
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedType={selectedType}
                setSelectedType={setSelectedType}
                setComponent={setComponent}
                availableTypes={availableTypes}
            />
            {loading ? (
                <ActivityIndicator size="large" color={colors.highlightColor} style={styles.loadingIndicator} />
            ) : (
                <FlatList
                    data={filteredWords}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundColor,
        padding: 10,
        paddingHorizontal: 20,
    },
    loadingIndicator: {
        marginTop: 20,
    },
    errorText: {
        color: 'red',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 20,
    },
});

export default WordList;
