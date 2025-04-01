import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import data from './../assets/info.json';

export const HomeScreen = ({ navigation }) => {
  const [selectedCategory, setSelectedCategory] = useState(data.categories[0]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredSubcategories = data.subcategories.filter(
    (sub) => sub.categoryID === selectedCategory.id && 
    (!showSearch || sub.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const navigateToWebView = (link) => {
    navigation.navigate('WebView', { link });
  };

  const renderSubcategoryGrid = () => {
    return (
      <View style={styles.grid}>
        {filteredSubcategories.map((subcategory) => (
          <TouchableOpacity
            key={subcategory.id}
            style={styles.subcategoryCard}
            onPress={() => navigateToWebView(subcategory.link)}
          >
            <View style={styles.subcategoryCardContent}>
              <MaterialIcons name={subcategory.icon} size={48} color="#0FA14D" />
              <Text numberOfLines={2} ellipsizeMode="tail" style={styles.subcategoryText}>
                {subcategory.name}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>
          {selectedCategory.name}
        </Text>
        <TouchableOpacity onPress={() => setShowSearch(!showSearch)}>
          <MaterialIcons name="search" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {showSearch && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar subcategorias..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      <ScrollView
        style={styles.subcategoriesContainer}
        contentContainerStyle={styles.subcategoriesContent}
      >
        {renderSubcategoryGrid()}
      </ScrollView>

      <View style={styles.bottomNav}>
        <View style={[styles.bottomBackground, { backgroundColor: '#0FA14D' }]} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScrollView}
        >
          {data.categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryItem}
              onPress={() => {
                setSelectedCategory(category);
                setSearchQuery('');
                setShowSearch(false);
              }}
            >
              {category.id === selectedCategory.id ? (
                <>
                  <View style={styles.selectedCategoryOuter}>
                    <View style={styles.selectedCategoryInner}>
                      <MaterialIcons name={category.icon} size={24} color="white" />
                    </View>
                  </View>
                  <Text style={styles.categoryText}>{category.name}</Text>
                </>
              ) : (
                <>
                  <View style={styles.unselectedCategory}>
                    <MaterialIcons name={category.icon} size={24} color="white" />
                  </View>
                  <Text style={styles.categoryText}>{category.name}</Text>
                </>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  toolbar: {
    backgroundColor: '#0FA14D',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
  },
  toolbarTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  searchInput: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  subcategoriesContainer: {
    flex: 1,
    marginBottom: 96,
  },
  subcategoriesContent: {
    padding: 16,
    paddingBottom: 120,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  subcategoryCard: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    elevation: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  subcategoryCardContent: {
    flex: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subcategoryText: {
    marginTop: 8,
    fontSize: 12,
    color: 'black',
    textAlign: 'center',
    flexShrink: 1,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#0FA14D',
  },
  bottomBackground: {
    width: '100%',
    height: 72,
    position: 'absolute',
    bottom: 0,
  },
  categoriesScrollView: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  categoryItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 100,
  },
  selectedCategoryOuter: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  selectedCategoryInner: {
    padding: 12,
    marginBottom: 4,
    backgroundColor: '#0FA14D',
    borderRadius: 120,
  },
  categoryText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    position: 'relative',
  },
  unselectedCategory: {
    marginBottom: 4,
  },
});