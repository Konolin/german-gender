import React, { useEffect, useState } from 'react';
import {
    SafeAreaView,
    StatusBar,
    StyleSheet,
    View,
} from 'react-native';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Practice from './components/Practice';
import SentenceBuilder from './components/SentenceBuilder';
import StatsScreen from './components/StatsScreen';
import AuthenticationPage from './components/AuthenticationPage';
import WordList from './components/WordList';
import { UserProvider, UserContext } from './context/UserContext';
import { synchronizeUnlockedWordsForUser } from './firebase/getUnlockedWords';
import colors from './styles/colors';
import initLocalDb from "./sqlite/init-sqlite";

const MainApp = () => {
    const [selectedComponent, setSelectedComponent] = useState('Home');
    const [numWordsToPractice, setNumWordsToPractice] = useState(5);
    const [wordType, setWordType] = useState('noun');
    const [componentAfterStats, setComponentAfterStats] = useState('Home');
    const [stats, setStats] = useState(null);

    const { currentUserId } = React.useContext(UserContext);

    useEffect(() => {
        const initialize = async () => {
            if (currentUserId) {
                await synchronizeUnlockedWordsForUser(currentUserId);
            }
        };
        initialize();
    }, [currentUserId]);

    return (
        <SafeAreaView style={styles.app}>
            <StatusBar
                barStyle="light-content"
                backgroundColor={colors.backgroundColor}
            />
            {selectedComponent !== 'WordList' && (
                <Navbar
                    setComponent={setSelectedComponent}
                    selectedComponent={selectedComponent}
                    setComponentAfterStats={setComponentAfterStats}
                />
            )}
            <View style={styles.mainContainer}>
                {selectedComponent === 'Home' && (
                    <Home
                        setNumWordsToPractice={setNumWordsToPractice}
                        setSelectedComponent={setSelectedComponent}
                        setWordType={setWordType}
                    />
                )}
                {selectedComponent === 'WordList' && <WordList setComponent={setSelectedComponent} />}
                {selectedComponent === 'Practice' && (
                    <Practice
                        numWordsToPractice={numWordsToPractice}
                        wordType={wordType}
                        setSelectedComponent={setSelectedComponent}
                        stats={stats}
                        setStats={setStats}
                    />
                )}
                {selectedComponent === 'SentenceBuilder' && (
                    <SentenceBuilder setSelectedComponent={setSelectedComponent} />
                )}
                {selectedComponent === 'AuthenticationPage' && (
                    <AuthenticationPage setSelectedComponent={setSelectedComponent} />
                )}
                {selectedComponent === 'StatsScreen' && (
                    <StatsScreen
                        setSelectedComponent={setSelectedComponent}
                        componentAfterStats={componentAfterStats}
                        stats={stats}
                        setStats={setStats}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const App = () => {
    initLocalDb();

    return (
        <UserProvider>
            <MainApp />
        </UserProvider>
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
        paddingHorizontal: 0,
    },
});

export default App;
