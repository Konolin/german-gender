import React, {useEffect, useState, useContext} from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Dimensions,
} from 'react-native';
import colors from '../styles/colors';
import Revision from './Revision';
import CustomAlert from './CustomAlert';
import UnderlineInput from "./UnderlineInput";
import {updateWordScoreForUser} from "../firebase/updateWordScore";
import {getUnlockedWordsForUser} from "../firebase/getUnlockedWords";
import {unlockNextWordForUser} from "../firebase/unlockNextWord";
import {UserContext} from "../context/UserContext";
import updateWordScoreForGuest from "../sqlite/updateWordScoreForGuest";
import unlockNextWordForGuest from "../sqlite/unlockNextWordForGuest";
import {getUnlockedWordsForGuest} from "../sqlite/getUnlockedWordsForGuest";

const Practice = ({numWordsToPractice, wordType, setSelectedComponent, setStats}) => {
    const [words, setWords] = useState([]);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);

    // For nouns
    const [selectedGender, setSelectedGender] = useState('');

    // For prepositions
    const [selectedPrepositionCase, setSelectedPrepositionCase] = useState('');

    const [germanWordInput, setGermanWordInput] = useState('');
    const [isReview, setIsReview] = useState(false);
    const [practiceRound, setPracticeRound] = useState(1);
    const [isReady, setIsReady] = useState(false);

    // Will be used for feedback with UnderlineInput, letter color based on correct or incorrect
    const [letterStatuses, setLetterStatuses] = useState([]);
    const [streak, setStreak] = useState(0);
    const {currentUserId} = useContext(UserContext);
    // used to prevent the manipulation of the streak score when spamming the submit button
    const [wasStreakUpdated, setWasStreakUpdated] = useState(false);

    // State for CustomAlert
    const [isCustomAlertVisible, setIsCustomAlertVisible] = useState(false);
    const [alertOptions, setAlertOptions] = useState({
        title: '',
        message: '',
        onCancel: () => {
        },
        onContinue: () => {
        },
    });

    // Calculate pill size based on screen width and number of words
    const screenWidth = Dimensions.get('window').width;
    const pillMargin = 2;
    const totalPills = words.length || numWordsToPractice;
    const maxPillContainerWidth = screenWidth - 40; // Adjust for padding
    const totalMargin = (totalPills - 1) * pillMargin * 2;
    const availableWidth = maxPillContainerWidth - totalMargin;
    const pillWidth = Math.min(availableWidth / totalPills, 20); // Max pill width
    const pillHeight = 10;

    /**
     * Initializes the practice session by selecting random words.
     */
    useEffect(() => {
        const initializeWords = async () => {
            try {
                // Retrieve only unlocked words grouped by type from Firestore
                const allWords = currentUserId
                    ? await getUnlockedWordsForUser(currentUserId)
                    : await getUnlockedWordsForGuest();

                // Extract the word list for the selected type
                const wordList = allWords[wordType] || [];

                // Adds a status property to each word that is only used in this component
                const wordsWithStatus = await Promise.all(
                    wordList.map(async (word) => {
                        return {
                            ...word,
                            attemptStatus: 'unattempted',
                        };
                    })
                );

                // Sort words by score ascending, then by position ascending
                const sortedWords = wordsWithStatus.sort((a, b) => {
                    if (a.score < b.score) return -1;
                    if (a.score > b.score) return 1;
                    // If score is the same, sort by position
                    if (a.position < b.position) return -1;
                    if (a.position > b.position) return 1;
                    return 0;
                });

                // Select the top `numWordsToPractice` words
                const selectedWords = sortedWords.slice(0, numWordsToPractice);

                // Update the state with the selected words
                setWords(selectedWords);

                // Initialize stats for the selected words
                if (practiceRound === 1) {
                    const initialStats = {};
                    selectedWords.forEach((word) => {
                        initialStats[word.german] = {
                            initialScore: word.score,
                            newScore: word.score,
                            newUnlock: false,
                        };
                    });
                    setStats(initialStats);
                }
            } catch (error) {
                console.error("Error initializing words:", error);
            }
        };

        initializeWords();
    }, [numWordsToPractice, wordType]);

    const currentWord = words[currentWordIndex];

    /**
     * Handles the user's answer submission.
     */
    const handleAnswerCheck = async () => {
        let isCorrect = false;

        // Noun logic
        if (currentWord.type === 'noun') {
            isCorrect =
                selectedGender === currentWord.article &&
                germanWordInput.toLowerCase() === currentWord.german.toLowerCase();
        }
        // Preposition logic
        else if (currentWord.type === 'preposition') {
            // Figure out which case(s) the current preposition takes
            const prepositionCases = currentWord.case || []; // e.g. ['accusative', 'dative']
            let correctCase = '';

            if (prepositionCases.length > 1) {
                // If it has both accusative and dative
                correctCase = 'both';
            } else if (prepositionCases[0] === 'accusative') {
                correctCase = 'accusative';
            } else {
                correctCase = 'dative';
            }

            // We check both the typed German word AND the selected case
            isCorrect =
                germanWordInput.toLowerCase() === currentWord.german.toLowerCase() &&
                selectedPrepositionCase === correctCase;
        }
        // Default logic for other word types
        else {
            isCorrect =
                germanWordInput.toLowerCase() === currentWord.german.toLowerCase();
        }

        // Calculate new score with bounds [-4, 4] only in the first round
        let newScore = currentWord.score;
        if (practiceRound === 1) {
            if (isCorrect) {
                newScore = Math.min(currentWord.score + 1, 4);
            } else {
                newScore = Math.max(currentWord.score - 1, -4);
            }
        }

        if (practiceRound === 1) {
            setStats((prevStats) => ({
                ...prevStats,
                [currentWord.german]: {
                    initialScore: currentWord.score,
                    newScore: newScore,
                    newUnlock: false,
                },
            }));
        }

        // increase the streak if the answer is correct and the streak was not already updated (to prevent spamming the submit button)
        setStreak(isCorrect && !wasStreakUpdated ? streak + 1 : 0);
        setWasStreakUpdated(true);

        // Update attemptStatus and score for the current word only in first round
        const updatedWords = words.map((word, index) => {
            if (index === currentWordIndex) {
                return {
                    ...word,
                    attemptStatus: isCorrect ? 'correct' : 'incorrect',
                    score: practiceRound === 1 ? newScore : word.score, // Only update score in first round
                };
            }
            return word;
        });

        setWords(updatedWords);

        // Update the score in Firestore using the custom ID only in the first round
        if (practiceRound === 1) {
            try {
                if (currentUserId) {
                    await updateWordScoreForUser(currentUserId, currentWord.id, newScore); // Use the custom ID
                } else {
                    await updateWordScoreForGuest(currentWord.id, newScore);
                }

                if (newScore === 4) {
                    const unlockedWord = currentUserId
                        ? await unlockNextWordForUser(currentWord.id, currentWord.type, currentUserId)
                        : await unlockNextWordForGuest(currentWord.id);
                    if (practiceRound === 1 && unlockedWord) {
                        setStats((prevStats) => ({
                            ...prevStats,
                            [unlockedWord.german]: {
                                initialScore: unlockedWord.score,
                                newScore: unlockedWord.score,
                                newUnlock: true,
                            },
                        }));
                    }
                }
            } catch (error) {
                console.error("Failed to update word score in Firestore:", error);
            }
        }

        // Generate letterStatuses for feedback using UnderlineInput
        const correctAnswer = currentWord.german.toLowerCase();
        const userAnswer = germanWordInput.toLowerCase();

        const maxLength = Math.max(correctAnswer.length, userAnswer.length);
        const newLetterStatuses = [];

        for (let i = 0; i < maxLength; i++) {
            const correctChar = correctAnswer[i];
            const userChar = userAnswer[i];

            if (!userChar) {
                // If no user input for this index => missing letter
                newLetterStatuses.push('missing');
            } else if (userChar === correctChar) {
                newLetterStatuses.push('correct');
            } else {
                newLetterStatuses.push('incorrect');
            }
        }
        setLetterStatuses(newLetterStatuses);

        // Enter review mode
        setIsReview(true);
    };

    /**
     * Handles moving to the next word or prompting for retry/home.
     */
    const handleContinue = () => {
        // reset the flag
        setWasStreakUpdated(false);

        // Check if we have reached the end of the words list
        if (currentWordIndex + 1 >= words.length) {
            // Check if there are any incorrect words
            const incorrectWords = words.filter(word => word.attemptStatus === 'incorrect');

            if (incorrectWords.length > 0) {
                // Configure CustomAlert options
                setAlertOptions({
                    title: 'Retry or Go Home',
                    message: 'You have incorrect words. Would you like to retry them or go back home?',
                    onCancel: handleGoHome, // First go to stats, then home
                    onContinue: handleRetry,
                });
                setIsCustomAlertVisible(true);
            } else {
                // All words have been practiced correctly, navigate to StatsScreen
                setSelectedComponent('StatsScreen');
            }
        } else {
            // Move to the next word
            setCurrentWordIndex(currentWordIndex + 1);

            // Reset form states
            setSelectedGender('');
            setSelectedPrepositionCase('');
            setGermanWordInput('');
            setIsReview(false);
        }
    };

    /**
     * Handles retrying the incorrect words.
     */
    const handleRetry = () => {
        // Extract incorrect words
        const incorrectWords = words.filter(word => word.attemptStatus === 'incorrect');

        if (incorrectWords.length === 0) {
            // No incorrect words to retry
            setSelectedComponent('Home');
            return;
        }

        // Select up to `numWordsToPractice` words for retry
        const retryWords = incorrectWords.slice(0, Math.min(numWordsToPractice, incorrectWords.length));

        // Reset the words array to only incorrect words
        const resetWords = retryWords.map((word, index) => ({
            ...word,
            attemptStatus: 'unattempted',
            id: `${word.english}-retry-${practiceRound}-${index}`, // Generate new unique ID
        }));
        setWords(resetWords);
        setCurrentWordIndex(0);
        setPracticeRound(practiceRound + 1);
        setStreak(0);

        // Reset form states
        setSelectedGender('');
        setSelectedPrepositionCase('');
        setGermanWordInput('');
        setIsReview(false);
    };

    /**
     * Handles navigating back to the Home screen.
     */
    const handleGoHome = () => {
        setSelectedComponent('StatsScreen');
    };

    /**
     * Unified submit/continue handler.
     */
    const handleSubmit = () => {
        if (!isReview) {
            handleAnswerCheck();
        } else {
            setLetterStatuses([]); // Reset letter statuses
            handleContinue();
        }
    };

    // Define pillStyle inside the component to use dynamic sizes
    const pillStyle = {
        width: pillWidth,
        height: pillHeight,
        borderRadius: pillHeight / 2,
        marginHorizontal: pillMargin,
        backgroundColor: colors.buttonBackgroundColor,
    };

    const getStreakString = () => {
        const streakColors = [colors.lowStreakColor, colors.mediumStreakColor, colors.highStreakColor];
        const streakMessages = [' in a row!', ' in a row!!', ' in a row!!!'];
        const thresholds = [0.33, 0.66, 1];

        for (let i = 0; i < thresholds.length; i++) {
            if (streak < Math.ceil((numWordsToPractice + 2) * thresholds[i])) {
                return (
                    <Text style={[styles.streakText, {color: streakColors[i]}]}>
                        {streak}{streakMessages[i]}
                    </Text>
                );
            }
        }
        return null;
    };

    return (
        <SafeAreaView style={styles.app}>
            <View style={styles.mainContainer}>
                {!isReady ? (
                    <Revision
                        words={words}
                        onReady={() => setIsReady(true)}
                    />
                ) : (
                    <>
                        {/* Pills at the Top */}
                        <View style={styles.pillsContainer}>
                            {words.map((word, index) => {
                                const isCurrent = index === currentWordIndex;
                                let pillStyles = [pillStyle];
                                if (isCurrent) {
                                    pillStyles.push({backgroundColor: colors.highlightColor});
                                } else if (word.attemptStatus === 'correct') {
                                    pillStyles.push({backgroundColor: colors.successColor});
                                } else if (word.attemptStatus === 'incorrect') {
                                    pillStyles.push({backgroundColor: colors.errorColor});
                                }

                                return (
                                    <View key={word.id} style={pillStyles}/>
                                );
                            })}
                        </View>

                        {/*Streak*/}
                        {streak > 1 && (
                            <View>
                                {getStreakString()}
                            </View>
                        )}

                        {/* Main Content */}
                        {currentWord && (
                            <View style={styles.mainContent}>
                                {/* Optional: Display Practice Round */}
                                {practiceRound > 1 && (
                                    <Text style={styles.roundText}>Round {practiceRound}</Text>
                                )}

                                <View key={currentWord.english} style={styles.fadeIn}>
                                    {!isReview ? (
                                        <Text style={styles.wordDisplayText}>
                                            {currentWord.english}
                                        </Text>
                                    ) : (
                                        <Text style={styles.wordDisplayText}>
                                            {currentWord.type === 'noun'
                                                ? `${currentWord.article} ${currentWord.german}`
                                                : `${currentWord.german}`}
                                        </Text>
                                    )}
                                </View>

                                {/* Gender Buttons - Only for Nouns */}
                                {currentWord.type === 'noun' && (
                                    <View style={styles.genderButtonContainer}>
                                        {['der', 'die', 'das'].map((gender) => {
                                            const isSelected = selectedGender === gender;
                                            const isCorrectArticle = currentWord.article === gender;
                                            let buttonStyle = [styles.genderSelectButton];
                                            let textStyle = [styles.genderButtonText];

                                            if (isSelected) {
                                                buttonStyle.push(styles.selectedGenderButton);
                                                textStyle.push(styles.selectedGenderText);
                                            }

                                            if (isReview && isSelected) {
                                                if (isCorrectArticle) {
                                                    buttonStyle.push(styles.correctBackground, styles.correctBorder);
                                                    textStyle.push(styles.whiteText);
                                                } else {
                                                    buttonStyle.push(styles.incorrectBackground, styles.incorrectBorder);
                                                    textStyle.push(styles.whiteText);
                                                }
                                            }

                                            return (
                                                <TouchableOpacity
                                                    key={gender}
                                                    onPress={() => {
                                                        if (!isReview) setSelectedGender(gender);
                                                    }}
                                                    style={buttonStyle}
                                                    disabled={isReview}
                                                >
                                                    <Text style={textStyle}>
                                                        {gender}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}

                                {/* Preposition Case Buttons - Only for Prepositions */}
                                {currentWord.type === 'preposition' && (
                                    <View style={styles.prepositionCaseButtonContainer}>
                                        {['Accusative', 'Dative', 'Both'].map((caseOption) => {
                                            const lowerCaseOption = caseOption.toLowerCase();
                                            const isSelected = selectedPrepositionCase === lowerCaseOption;

                                            // Determine the "true" correct case
                                            const prepositionCases = currentWord.case || [];
                                            let correctCase = '';
                                            if (prepositionCases.length > 1) {
                                                correctCase = 'both';
                                            } else if (prepositionCases[0] === 'accusative') {
                                                correctCase = 'accusative';
                                            } else {
                                                correctCase = 'dative';
                                            }

                                            let buttonStyle = [styles.prepositionCaseButton];
                                            let textStyle = [styles.prepositionCaseButtonText];

                                            if (isSelected) {
                                                buttonStyle.push(styles.selectedPrepositionCaseButton);
                                                textStyle.push(styles.selectedPrepositionCaseText);
                                            }

                                            // In review mode, highlight if user’s selection was correct or not
                                            if (isReview && isSelected) {
                                                if (lowerCaseOption === correctCase) {
                                                    buttonStyle.push(styles.correctBackground, styles.correctBorder);
                                                    textStyle.push(styles.whiteText);
                                                } else {
                                                    buttonStyle.push(styles.incorrectBackground, styles.incorrectBorder);
                                                    textStyle.push(styles.whiteText);
                                                }
                                            }

                                            return (
                                                <TouchableOpacity
                                                    key={caseOption}
                                                    onPress={() => {
                                                        if (!isReview) setSelectedPrepositionCase(lowerCaseOption);
                                                    }}
                                                    style={buttonStyle}
                                                    disabled={isReview}
                                                >
                                                    <Text style={textStyle}>{caseOption}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}

                                {!isReview ? (
                                    <>
                                        {/* UnderlineInput Component for Input */}
                                        {
                                            // For nouns, we show the input only after user selects a gender.
                                            // For prepositions, we show it only after user selects a case.
                                            // For others, we always show it.
                                            (
                                                (currentWord.type === 'noun' && selectedGender) ||
                                                (currentWord.type === 'preposition' && selectedPrepositionCase) ||
                                                (currentWord.type !== 'noun' && currentWord.type !== 'preposition')
                                            ) && (
                                                <UnderlineInput
                                                    value={germanWordInput}
                                                    onChangeText={setGermanWordInput}
                                                    length={currentWord.german.length}
                                                    editable={!isReview}
                                                    autoFocus
                                                />
                                            )
                                        }

                                        {/* Submit Button */}
                                        {
                                            // For nouns, require gender + typed input
                                            // For prepositions, require case + typed input
                                            // Otherwise, just typed input
                                            (
                                                (currentWord.type === 'noun' &&
                                                    selectedGender &&
                                                    germanWordInput.trim()) ||
                                                (currentWord.type === 'preposition' &&
                                                    selectedPrepositionCase &&
                                                    germanWordInput.trim()) ||
                                                ((currentWord.type !== 'noun' && currentWord.type !== 'preposition') &&
                                                    germanWordInput.trim())
                                            ) ? (
                                                <View style={styles.germanWordForm}>
                                                    <TouchableOpacity
                                                        onPress={handleSubmit}
                                                        style={[styles.submitButton]}
                                                    >
                                                        <Text style={styles.submitButtonText}>Submit</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <Text style={styles.instructionText}>
                                                    {currentWord.type === 'noun' && !selectedGender
                                                        ? <>Choose an <Text
                                                            style={styles.highlightText}>article</Text> first</>
                                                        : currentWord.type === 'preposition' && !selectedPrepositionCase
                                                            ? <>Choose a <Text
                                                                style={styles.highlightText}>case</Text> first</>
                                                            : <>What is German for <Text
                                                                style={styles.highlightText}>{currentWord.english}</Text>?</>
                                                    }
                                                </Text>
                                            )
                                        }
                                    </>
                                ) : (
                                    <>
                                        {/* UnderlineInput Component for Feedback */}
                                        <UnderlineInput
                                            value={germanWordInput}
                                            length={currentWord.german.length}
                                            editable={false}
                                            letterStatuses={letterStatuses}
                                        />
                                        <TouchableOpacity
                                            onPress={handleSubmit}
                                            style={[styles.submitButton, styles.continueButton]}
                                        >
                                            <Text style={styles.submitButtonText}>
                                                {(currentWordIndex + 1 >= words.length && words.some(word => word.attemptStatus === 'incorrect'))
                                                    ? 'Retry Incorrect Words'
                                                    : (currentWordIndex + 1 >= words.length)
                                                        ? 'Finish'
                                                        : 'Continue'}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        )}
                    </>
                )}

                {/* Custom Alert Modal */}
                <CustomAlert
                    visible={isCustomAlertVisible}
                    title={alertOptions.title}
                    message={alertOptions.message}
                    onCancel={() => {
                        alertOptions.onCancel();
                        setIsCustomAlertVisible(false);
                    }}
                    onContinue={() => {
                        alertOptions.onContinue();
                        setIsCustomAlertVisible(false);
                    }}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    app: {
        flex: 1,
        backgroundColor: colors.backgroundColor,
    },
    mainContainer: {
        flex: 1,
        backgroundColor: colors.backgroundColor,
        paddingHorizontal: 10,
        paddingTop: 20,
    },
    pillsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        flexWrap: 'nowrap',
    },

    mainContent: {
        alignItems: 'center',
        paddingVertical: 20,
        flex: 1,
    },
    fadeIn: {
        alignItems: 'center',
    },
    wordDisplayText: {
        fontSize: 24,
        textAlign: 'center',
        marginVertical: 16,
        color: colors.textColor,
    },
    genderButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    genderSelectButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: colors.buttonBackgroundColor,
        borderRadius: 8,
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    selectedGenderButton: {
        borderColor: colors.highlightColor,
        borderWidth: 2,
    },
    correctBorder: {
        borderColor: colors.successColor,
        borderWidth: 2,
    },
    incorrectBorder: {
        borderColor: colors.errorColor,
        borderWidth: 2,
    },
    correctBackground: {
        backgroundColor: colors.successColor,
    },
    incorrectBackground: {
        backgroundColor: colors.errorColor,
    },
    whiteText: {
        color: '#fff',
    },

    genderButtonText: {
        fontSize: 18,
        color: '#fff',
        fontWeight: '500',
    },
    selectedGenderText: {
        color: colors.highlightColor,
    },

    // Preposition case buttons
    prepositionCaseButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    prepositionCaseButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: colors.buttonBackgroundColor,
        borderRadius: 8,
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: 'transparent',
        width: 120,
    },
    prepositionCaseButtonText: {
        alignSelf: 'center',
        fontSize: 16,
        color: '#fff',
        fontWeight: '500',
    },
    selectedPrepositionCaseButton: {
        borderColor: colors.highlightColor,
        borderWidth: 2,
    },
    selectedPrepositionCaseText: {
        color: colors.highlightColor,
    },

    germanWordForm: {
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 20,
    },
    submitButton: {
        backgroundColor: colors.buttonBackgroundColor,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    continueButton: {
        marginTop: 10,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    roundText: {
        fontSize: 18,
        color: colors.textColor,
        marginBottom: 10,
    },
    streakText: {
        fontSize: 18,
        textAlign: 'center',
        marginVertical: 10,
    },
    instructionText: {
        paddingVertical: 20,
        paddingHorizontal: 20,
        fontSize: 18,
        color: colors.textColor, // Use a noticeable color
        textAlign: 'center',
        fontStyle: 'italic',
    },
    highlightText: {
        fontWeight: 'bold',
        color: colors.highlightColor, // Choose a standout color
    },
});

export default Practice;
