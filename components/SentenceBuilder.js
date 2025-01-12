import React, {useContext, useEffect, useState} from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView
} from 'react-native';
import colors from '../styles/colors';
import highlightSentence from "../utils/highlightSentence";
import * as Speech from 'expo-speech';
import {getUnlockedWordsForUser} from "../firebase/getUnlockedWords";
import {UserContext} from "../context/UserContext";
import {getUnlockedWordsForGuest} from "../sqlite/getUnlockedWordsForGuest";

// Helper function to determine label color by article/type
const getLabelColor = (article, type) => {
    if (article) {
        const colorMap = {
            der: colors.highlightColor,
            die: colors.dieColor,
            das: colors.successColor,
        };
        return colorMap[article.toLowerCase()] || colors.textColor;
    }

    const typeColorMap = {
        verb: colors.verbColor,
        adjective: colors.adjectiveColor,
        adverb: colors.errorColor,
        pronoun: colors.pronounColor,
        preposition: colors.prepositionColor,
    };

    return typeColorMap[type.toLowerCase()] || colors.textColor;
};

const SentenceBuilder = () => {
    const [selectedWordTypes, setSelectedWordTypes] = useState([]);
    const [selectedWords, setSelectedWords] = useState({});
    const [sentence, setSentence] = useState('');
    const [translation, setTranslation] = useState('');
    const [explanation, setExplanation] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [highlightedSentence, setHighlightedSentence] = useState([]);
    const [wordsData, setWordsData] = useState({
        noun: [],
        verb: [],
        adjective: [],
        adverb: [],
        pronoun: [],
        preposition: [],
    });
    const {currentUserId} = useContext(UserContext);

    // Controls if the full-screen result is shown
    const [showResults, setShowResults] = useState(false);

    const wordTypes = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition'];

    useEffect(() => {
        const fetchWords = async () => {
            setWordsData(currentUserId
                ? await getUnlockedWordsForUser(currentUserId)
                : await getUnlockedWordsForGuest());
        };
        fetchWords();
    }, []);

    // Automatically determine difficulty level
    const getDifficultyLevel = () => {
        const count = selectedWordTypes.length;
        if (count <= 1) return 'A1';
        if (count === 2) return 'A2';
        if (count === 3) return 'B1 (easier)';
        if (count >= 4) return 'B1 (advanced)';
        return 'A1';
    };

    /**
     * Toggle word type and move the newly toggled type to the front so
     * its words appear at the top of the list.
     */
    const handleWordTypeToggle = (type) => {
        setSelectedWords((prev) => {
            // If we are removing the type, remove the word
            const newSelectedWords = {...prev};
            delete newSelectedWords[type];
            return newSelectedWords;
        });

        setSelectedWordTypes((prev) => {
            // If already selected => remove it
            if (prev.includes(type)) {
                return prev.filter((t) => t !== type);
            }
            // else add to the FRONT to show that list at top
            return [type, ...prev];
        });

        // Clear previous results
        setExplanation('');
        setSentence('');
        setTranslation('');
        setHighlightedSentence([]);
        setShowResults(false);
    };

    /**
     * Select a word for a given type.
     * Also resets existing results.
     */
    const handleWordSelect = (type, word) => {
        setSelectedWords((prev) => ({
            ...prev,
            [type]: word,
        }));
        // Clear previous results
        setExplanation('');
        setSentence('');
        setTranslation('');
        setHighlightedSentence([]);
        setShowResults(false);
    };

    const generateSentence = async () => {
        setShowResults(true);
        setIsLoading(true);

        const difficultyLevel = getDifficultyLevel();
        let prompt = `Create a German sentence at the ${difficultyLevel} level that includes `;
        const wordTypePrompts = [];

        selectedWordTypes.forEach((type) => {
            const word = selectedWords[type];
            if (word) {
                wordTypePrompts.push(`the ${type} "${word.german}"`);
            }
        });

        prompt += wordTypePrompts.join(' and ') + '.';

        if (difficultyLevel === 'B1 (advanced)') {
            prompt +=
                ' You are allowed to use a subordinate clause or the genitive case if needed.';
        } else if (difficultyLevel === 'B1 (easier)') {
            prompt +=
                ' Use compound sentences with connectors like "und" or "aber". Do not use subordinate clauses or the genitive case.';
        } else {
            prompt += ' Do not use subordinate clauses or the genitive case.';
        }

        prompt +=
            ' Provide the German sentence first, and then on a new line, provide the English translation starting with "Translation: ".';

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPEN_AI_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{role: 'user', content: prompt}],
                }),
            });

            const data = await response.json();

            if (data.choices && data.choices.length > 0) {
                const fullResponse = data.choices[0].message.content.trim();
                const [germanSentence, translationText] = fullResponse.split('Translation: ');
                const germanText = germanSentence.trim();
                const translationTextTrimmed = translationText ? translationText.trim() : '';

                setSentence(germanText);
                setTranslation(translationTextTrimmed);

                // Highlight the German sentence
                const highlighted = highlightSentence(germanText, selectedWords);
                setHighlightedSentence(highlighted);

                // Generate explanation
                await generateExplanation(germanText);
            } else {
                setSentence('No sentence was generated. Please try again.');
                setTranslation('');
                setExplanation('');
                setHighlightedSentence([]);
            }
        } catch (error) {
            console.error('Error generating sentence:', error);
            setSentence('An error occurred while generating the sentence.');
            setTranslation('');
            setExplanation('');
            setHighlightedSentence([]);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Get a brief explanation from the model
     */
    const generateExplanation = async (germanSentence) => {
        const explanationPrompt = `When I provide a German sentence, explain any grammatical rules or concepts that might be new or challenging for an A1 level learner. Focus only on deviations from basic sentence structures that a beginner might find confusing. Provide brief explanations.

Use the following format:

Rule: [Brief explanation]

Examples:

Rule: 'kann' is a modal verb, so the main verb 'fahren' moves to the end in its infinitive form.
Rule: The accusative case is used for direct objects, so 'der Ball' changes to 'den Ball'. Masculine nouns change their article from 'der' to 'den' in the accusative case.
Rule: The verb 'sehen' is irregular, meaning its stem changes when conjugated (e.g., 'sehen' → 'sehe/siehst/sieht').

Now, analyze the following sentence and provide the rule(s) that apply:

"${germanSentence}"`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPEN_AI_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{role: 'user', content: explanationPrompt}],
                    temperature: 0.5,
                }),
            });

            const data = await response.json();

            if (data.error) {
                console.error('OpenAI API Error:', data.error);
                setExplanation('An error occurred while generating the explanation.');
                return;
            }

            if (data.choices && data.choices.length > 0) {
                setExplanation(data.choices[0].message.content.trim());
            } else {
                setExplanation('No explanation was generated. Please try again.');
            }
        } catch (error) {
            console.error('Error generating explanation:', error);
            setExplanation('An error occurred while generating the explanation.');
        }
    };

    // Speak sentence whenever it changes
    useEffect(() => {
        if (sentence && showResults && !isLoading) {
            // Speak the German sentence
            Speech.stop();
            Speech.speak(sentence, {language: 'de-DE', pitch: 1.0, rate: 1.0});
        }
        return () => Speech.stop();
    }, [sentence, showResults, isLoading]);

    return (
        <View style={styles.container}>
            {/* Only show the big title if no types selected yet */}
            {selectedWordTypes.length === 0 && (
                <>
                    <Text style={styles.title}>Sentence Builder</Text>
                    <Text style={styles.subtitleExplanation}>
                        Here you can generate sentences using your Unlocked Words.
                    </Text>
                    <Text style={styles.subtitleExplanation}>
                        You can only use one word for each type (noun, verb, etc.).
                    </Text>
                </>
            )}

            {/* Word Type Selection */}
            {selectedWordTypes.length === 0 ? (
                <Text style={styles.subtitle}>Select a type first:</Text>
            ) : (
                <Text style={styles.subtitle}>You can select multiple types:</Text>
            )}
            <View style={styles.optionsContainer}>
                {wordTypes.map((type) => (
                    <TouchableOpacity
                        key={type}
                        style={[
                            styles.optionButton,
                            selectedWordTypes.includes(type) && styles.selectedOptionButton,
                        ]}
                        onPress={() => handleWordTypeToggle(type)}
                    >
                        <Text
                            style={[
                                styles.optionButtonText,
                                selectedWordTypes.includes(type) && styles.selectedOptionButtonText,
                            ]}
                        >
                            {type}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/**
             * For each type in selectedWordTypes (in the custom order),
             * show that type's word list at the top if it's the newest,
             * or further down if older, thanks to our array reordering.
             */}
            <ScrollView style={styles.wordSelectionScroll} contentContainerStyle={styles.wordSelectionScrollContent}>
                {selectedWordTypes.map((type) => {
                    const selectedWord = selectedWords[type];
                    // filter out the chosen word so it doesn't appear below
                    const filteredWords = wordsData[type]?.filter(
                        (w) => w.german !== selectedWord?.german
                    );

                    // If a word is selected, we display it as colored text
                    let labelColor = selectedWord
                        ? getLabelColor(selectedWord.article, type)
                        : colors.textColor;

                    return (
                        <View key={type} style={styles.wordSelectionContainer}>
                            {!selectedWord ? (
                                // No word selected yet
                                <Text style={styles.subtitle}>Select one {type}:</Text>
                            ) : (
                                // Word is selected => show colored text
                                <View style={styles.selectedContainer}>
                                    <Text style={styles.subtitle}>
                                        {type.charAt(0).toUpperCase() + type.slice(1)} selected:
                                    </Text>
                                    <Text style={[styles.coloredWordText, {color: labelColor}]}>
                                        {selectedWord.german}
                                    </Text>
                                </View>
                            )}

                            {/* Show the remaining words if no word or if user wants to change? */}
                            <View style={styles.wordsContainer}>
                                {filteredWords.map((word) => (
                                    <TouchableOpacity
                                        key={word.german}
                                        style={styles.wordButton}
                                        onPress={() => handleWordSelect(type, word)}
                                    >
                                        <Text style={styles.wordButtonText}>{word.german}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            {/* Generate Sentence Button */}
            <TouchableOpacity
                style={[
                    styles.generateButton,
                    (isLoading || selectedWordTypes.some((type) => !selectedWords[type])) &&
                    styles.disabledButton,
                ]}
                onPress={generateSentence}
                disabled={isLoading || selectedWordTypes.some((type) => !selectedWords[type])}
            >
                <Text style={styles.generateButtonText}>Generate Sentence</Text>
            </TouchableOpacity>

            {/* Results Modal */}
            {showResults && (
                <View style={styles.overlayContainer}>
                    <View style={styles.modalHeader}>
                        {/* Close / Choose Other Words Button */}
                        <TouchableOpacity
                            style={styles.closeButtonContainer}
                            onPress={() => setShowResults(false)}
                        >
                            <Text style={styles.closeButtonText}>Choose Other Words</Text>
                        </TouchableOpacity>

                        {/* Show selected words as colored text */}
                        <View style={styles.selectedWordsRow}>
                            {Object.entries(selectedWords).map(([type, w]) => {
                                const color = getLabelColor(w.article, type);
                                return (
                                    <Text
                                        key={w.german}
                                        style={[styles.selectedWordItem, {color}]}
                                    >
                                        {w.german}{'  '}
                                    </Text>
                                );
                            })}
                        </View>

                        {/* Loading Indicator */}
                        {isLoading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={colors.highlightColor}/>
                                <Text style={styles.generatingText}>
                                    Currently generating your sentence...
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Show sentence/translation/explanation when done loading */}
                    {!isLoading && (
                        <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsScrollContent}>
                            {sentence !== '' && (
                                <View style={styles.sentenceContainer}>
                                    <Text style={styles.sentence}>
                                        {highlightedSentence.length > 0
                                            ? highlightedSentence.map((element, index) => (
                                                <React.Fragment key={index}>{element}</React.Fragment>
                                            ))
                                            : sentence}
                                    </Text>
                                    {translation !== '' && (
                                        <Text style={styles.translation}>Translation: {translation}</Text>
                                    )}
                                </View>
                            )}

                            {/** Explanation Text Box */}
                            {explanation !== '' && (
                                <View style={styles.explanationContainer}>
                                    <Text style={styles.explanationTitle}>Explanation:</Text>

                                    {/**
                                     * 1) Split the entire explanation text into lines by "\n"
                                     * 2) For each line, if it starts with "Rule:", highlight that portion
                                     */}
                                    {explanation.split('\n').map((line, idx) => {
                                        // We'll check if line starts with "Rule:"
                                        if (line.trim().startsWith('Rule:')) {
                                            // Grab everything after 'Rule:'
                                            const restOfLine = line.trim().substring('Rule:'.length);

                                            return (
                                                <Text key={idx} style={styles.explanationText}>
                                                    <Text style={{fontWeight: 'bold', color: colors.highlightColor}}>
                                                        Rule:
                                                    </Text>
                                                    {restOfLine}
                                                </Text>
                                            );
                                        }

                                        // Otherwise, render the line normally
                                        return (
                                            <Text key={idx} style={styles.explanationText}>
                                                {line}
                                            </Text>
                                        );
                                    })}
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    /* Container layout */
    container: {
        flex: 1,
        backgroundColor: colors.backgroundColor,
        paddingHorizontal: 15,
        paddingTop: 30,
    },

    /* Titles */
    title: {
        fontSize: 30,
        color: colors.textColor,
        textAlign: 'center',
        fontWeight: 'bold',
        marginBottom: 25,
    },
    subtitle: {
        fontSize: 18,
        color: colors.textColor,
        marginVertical: 10,
        fontWeight: '600',
    },
    subtitleExplanation: {
        fontSize: 14,
        color: colors.textColor,
        marginVertical: 20,
        fontWeight: '600',
        textAlign: 'center',
    },

    /* Word-type selection row */
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 10,
    },
    optionButton: {
        backgroundColor: colors.buttonBackgroundColor,
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        margin: 5,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    selectedOptionButton: {
        backgroundColor: colors.highlightColor,
    },
    optionButtonText: {
        color: '#fff',
        fontSize: 16,
    },
    selectedOptionButtonText: {
        color: '#242424',
        fontWeight: 'bold',
    },

    /* Word selection region */
    wordSelectionScroll: {
        flex: 1,
        marginTop: 5,
    },
    wordSelectionScrollContent: {
        paddingBottom: 20,
    },
    wordSelectionContainer: {
        marginBottom: 15,
        paddingHorizontal: 5,
    },
    selectedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    coloredWordText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    wordsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 5,
    },
    wordButton: {
        backgroundColor: colors.cardBackgroundColor,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        margin: 5,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    wordButtonText: {
        color: '#fff',
        fontSize: 14,
    },

    /* Generate button */
    generateButton: {
        backgroundColor: colors.successColor,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginVertical: 15,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 4,
    },
    disabledButton: {
        backgroundColor: '#999',
        shadowOpacity: 0,
        elevation: 0,
    },
    generateButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },

    /* Modal overlay */
    overlayContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.backgroundColor,
        justifyContent: 'flex-start',
    },
    modalHeader: {
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 40,
        marginHorizontal: 20,
        marginBottom: 20,
    },
    closeButtonContainer: {
        backgroundColor: colors.buttonBackgroundColor,
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '600',
    },
    selectedWordsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedWordItem: {
        fontSize: 16,
        fontWeight: 'bold',
        marginHorizontal: 4,
        marginTop: 4,
    },

    /* Loading in the modal */
    loadingContainer: {
        marginTop: 20,
        alignItems: 'center',
    },
    generatingText: {
        color: colors.textColor,
        fontSize: 16,
        marginTop: 10,
    },

    /* Results container */
    resultsScroll: {
        flex: 1,
        marginHorizontal: 20,
        marginBottom: 30,
        marginTop: 10,
    },
    resultsScrollContent: {
        paddingBottom: 40,
    },

    /* Sentence/translation */
    sentenceContainer: {
        backgroundColor: colors.cardBackgroundColor,
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    sentence: {
        color: colors.textColor,
        fontSize: 18,
        marginBottom: 10,
        lineHeight: 24,
    },
    translation: {
        color: colors.textColor,
        fontSize: 16,
        fontStyle: 'italic',
    },

    /* Explanation box */
    explanationContainer: {
        backgroundColor: colors.cardBackgroundColor,
        padding: 12,
        borderRadius: 8,
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    explanationTitle: {
        color: colors.textColor,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    explanationText: {
        color: colors.textColor,
        fontSize: 16,
        lineHeight: 22,
    },
});

export default SentenceBuilder;
