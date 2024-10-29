import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TextInput } from 'react-native';
import wordsData from '../data/wordsData';
import colors from '../styles/colors';
import Flashcard from './Flashcard';
import { getWordScore } from '../utils/storage';

const Learn = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [allWords, setAllWords] = useState([]);

    useEffect(() => {
        const loadWords = async () => {
            // Flatten the wordsData and include type
            const flatWords = Object.entries(wordsData).flatMap(([type, words]) =>
                words.map(word => ({ ...word, type }))
            );

            // Fetch scores for each word and merge them
            const wordsWithScores = await Promise.all(
                flatWords.map(async word => {
                    const score = await getWordScore(word.type, word.german);
                    return { ...word, score };
                })
            );

            setAllWords(wordsWithScores);
        };

        loadWords();
    }, []);

    const filteredWords = allWords.filter(
        word =>
            word.german.toLowerCase().includes(searchQuery.toLowerCase()) ||
            word.english.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderItem = ({ item }) => <Flashcard item={item} />;

    return (
        <View style={styles.container}>
            <TextInput
                style={styles.searchInput}
                placeholder="Search words..."
                placeholderTextColor={colors.textColor}
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
            <FlatList
                data={filteredWords}
                renderItem={renderItem}
                keyExtractor={item => `${item.german}-${item.english}`}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundColor,
        padding: 20,
    },
    searchInput: {
        width: '100%',
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        paddingHorizontal: 10,
        marginBottom: 20,
        fontWeight: '500',
        fontSize: 16,
        color: colors.textColor,
        backgroundColor: colors.inputBackgroundColor,
        borderRadius: 8,
    },
});

export default Learn;
