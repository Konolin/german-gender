import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import colors from '../styles/colors';

const WordListHeader = ({
                         searchQuery,
                         setSearchQuery,
                         selectedType,
                         setSelectedType,
                         setComponent,
                         availableTypes, // Receive ordered types
                     }) => {
    return (
        <View style={styles.headerContainer}>
            <View style={styles.homeSearchContainer}>
                <TouchableOpacity onPress={() => setComponent('Home')}>
                    <Text style={styles.navbarTitle}>Home</Text>
                </TouchableOpacity>
                <TextInput
                    style={styles.searchInput}
                    placeholder={`Search ${selectedType || 'words'}...`}
                    placeholderTextColor={colors.textColor}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>
            <View style={styles.filterContainer}>
                {availableTypes.map((type) => (
                    <TouchableOpacity
                        key={type}
                        style={[
                            styles.filterButton,
                            selectedType === type && styles.activeFilterButton,
                        ]}
                        onPress={() => setSelectedType(type)}
                    >
                        <Text
                            style={[
                                styles.filterText,
                                selectedType === type && styles.activeFilterText,
                            ]}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        marginBottom: 20,
    },
    homeSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    navbarTitle: {
        color: colors.textColor,
        fontSize: 18,
        fontWeight: 'bold',
    },
    searchInput: {
        flex: 1,
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        paddingHorizontal: 10,
        fontSize: 16,
        color: colors.textColor,
        backgroundColor: colors.inputBackgroundColor,
        borderRadius: 8,
        marginLeft: 15,
    },
    filterContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    filterButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'gray',
        backgroundColor: colors.inputBackgroundColor,
        alignItems: 'center',
        marginBottom: 10,
    },
    activeFilterButton: {
        backgroundColor: colors.highlightColor,
    },
    filterText: {
        color: colors.textColor,
        fontSize: 14,
    },
    activeFilterText: {
        color: colors.textColor,
        fontWeight: 'bold',
    },
});

export default WordListHeader;
