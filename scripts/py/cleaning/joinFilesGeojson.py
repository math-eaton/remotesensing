
import pandas as pd
import os
import geojson

def load_data(file_path):
    """
    Load data from a given file path, determining if it's JSON or CSV.
    
    Parameters:
    file_path (str): The path to the input file.
    
    Returns:
    pd.DataFrame: A pandas DataFrame containing the data from the input file.
    """
    file_extension = os.path.splitext(file_path)[1].lower()
    if file_extension in ['.json', '.geojson']:
        # Attempt to detect if it's a GeoJSON by checking for specific keys
        with open(file_path) as f:
            data = json.load(f)
        if data.get('type') == 'FeatureCollection' and 'features' in data:
            # It's a GeoJSON; extract data from properties
            features = data['features']
            properties_data = [feature['properties'] for feature in features]
            return pd.DataFrame(properties_data)
        else:
            # It's a regular JSON
            return pd.DataFrame(data)
    elif file_extension == '.csv':
        return pd.read_csv(file_path)
    else:
        raise ValueError(f'Unsupported file format: {file_extension}')
    
def preprocess_join_field(df, join_field):
    """
    Preprocess a DataFrame to modify the join field, keeping only the part before an underscore.

    Parameters:
    df (pd.DataFrame): The DataFrame to process.
    join_field (str): The name of the field to preprocess.

    Returns:
    pd.DataFrame: The processed DataFrame with the modified join field.
    """
    if join_field in df.columns:
        # Split the join_field value on underscore and keep the first part
        df[join_field] = df[join_field].str.split('_').str[0]
    return df

def dataframe_to_geojson(df, geometry_col='geometry', properties_cols=None):
    """
    Convert a pandas DataFrame with geometry and properties to a GeoJSON format.
    
    Parameters:
    df (pd.DataFrame): DataFrame containing the data.
    geometry_col (str): Column name where geometry data is stored.
    properties_cols (list): List of column names to include as properties. If None, include all except geometry.
    
    Returns:
    dict: A GeoJSON structure as a Python dictionary.
    """
    if properties_cols is None:
        properties_cols = [col for col in df.columns if col != geometry_col]
    
    features = []
    for _, row in df.iterrows():
        feature = {
            'type': 'Feature',
            'geometry': json.loads(row[geometry_col]),
            'properties': {prop: row[prop] for prop in properties_cols}
        }
        features.append(feature)
    
    return {
        'type': 'FeatureCollection',
        'features': features
    }


def join_datasets(file_path_1, file_path_2, join_field, output_path, output_format='geojson'):
    """
    Join two datasets based on a join field and save the output as GeoJSON.
    
    Adjusted to assume df1 comes from a GeoJSON with 'geometry' preserved during loading.
    """
    # Load and preprocess datasets
    df1 = preprocess_join_field(load_data(file_path_1), join_field)
    df2 = preprocess_join_field(load_data(file_path_2), join_field)
    
    # Assuming df1 contains a 'geometry' column in JSON string format
    # If df2 also contains geometries, ensure they are handled/merged as needed
    
    # Perform an inner join on the join field
    joined_df = pd.merge(df1, df2, on=join_field, how='inner')
    
    # Convert joined DataFrame to GeoJSON
    if output_format.lower() == 'geojson':
        geojson_data = dataframe_to_geojson(joined_df, geometry_col='geometry')
        with open(output_path, 'w') as f:
            json.dump(geojson_data, f)
    else:
        raise ValueError(f'Unsupported output format: {output_format}')
    """
    Join two datasets based on a join field and save the output.
    
    Parameters:
    file_path_1 (str): The path to the first input file.
    file_path_2 (str): The path to the second input file.
    join_field (str): The name of the field to join on.
    output_path (str): The path to save the joined dataset.
    output_format (str): The format to save the joined dataset ('csv' or 'json').
    """
    # Load the datasets
    df1 = load_data(file_path_1)
    df2 = load_data(file_path_2)

    # Preprocess the join field in both DataFrames
    df1 = preprocess_join_field(df1, join_field)
    df2 = preprocess_join_field(df2, join_field)
    
    # Perform an inner join on the join field
    joined_df = pd.merge(df1, df2, on=join_field, how='inner')
    
    # Save the joined DataFrame to the specified output format
    if output_format == 'csv':
        joined_df.to_csv(output_path, index=False)
    elif output_format == 'json':
        joined_df.to_json(output_path, orient='records')
    else:
        raise ValueError(f'Unsupported output format: {output_format}')

# Example usage
file_path_1 = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_processed.geojson'  # Change to your file path
file_path_2 = 'src/assets/data/fcc/fm/processed/fm_info_cleaned.csv'  # Change to your file path
join_field = 'lms_application_id'  # The field name to join on
output_path = 'src/assets/data/fcc/fm/processed/FM_contours_AOI_hubSpokes_processed_join.geojson'  # The output file path
output_format = 'geojson'  # Change to 'json' if you want JSON output

# Uncomment the line below to run the example with your file paths and preferences
# join_datasets(file_path_1, file_path_2, join_field, output_path, output_format)
