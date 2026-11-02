using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

public static class SetupPatio
{
    [MenuItem("Patio RD/Crear escena y configurar URP")]
    public static void Create()
    {
        const string pipelinePath="Assets/PatioPipeline.asset";
        var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(pipelinePath);
        if(pipeline==null)
        {
            var renderer=ScriptableObject.CreateInstance<UniversalRendererData>();
            AssetDatabase.CreateAsset(renderer,"Assets/PatioRenderer.asset");
            pipeline=UniversalRenderPipelineAsset.Create(renderer); AssetDatabase.CreateAsset(pipeline,pipelinePath);
        }
        GraphicsSettings.defaultRenderPipeline=pipeline; QualitySettings.renderPipeline=pipeline;
        // A serialized Resources material retains the dynamically instantiated shader in builds.
        if(!AssetDatabase.IsValidFolder("Assets/Resources"))AssetDatabase.CreateFolder("Assets","Resources");
        if(AssetDatabase.LoadAssetAtPath<Material>("Assets/Resources/PatioMaterial.mat")==null)
            AssetDatabase.CreateAsset(new Material(Shader.Find("Universal Render Pipeline/Lit")),"Assets/Resources/PatioMaterial.mat");
        PlayerSettings.defaultInterfaceOrientation=UIOrientation.LandscapeLeft;
        PlayerSettings.companyName="Patio RD"; PlayerSettings.productName="Dominó Patio RD";
        PlayerSettings.SetApiCompatibilityLevel(UnityEditor.Build.NamedBuildTarget.Standalone,ApiCompatibilityLevel.NET_Standard);
        var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        new GameObject("Patio RD",typeof(PatioRD.PatioTable));
        EditorSceneManager.SaveScene(scene,"Assets/Patio.unity");
        EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene("Assets/Patio.unity",true)};
        AssetDatabase.SaveAssets();
    }
}
