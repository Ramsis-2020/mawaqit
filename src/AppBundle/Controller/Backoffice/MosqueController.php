<?php

namespace AppBundle\Controller\Backoffice;

use AppBundle\Entity\Mosque;
use AppBundle\Entity\User;
use AppBundle\Exception\GooglePositionException;
use AppBundle\Form\ConfigurationType;
use AppBundle\Form\MosqueSearchType;
use AppBundle\Form\MosqueSyncType;
use AppBundle\Form\MosqueType;
use AppBundle\Service\Calendar;
use Doctrine\ORM\EntityManagerInterface;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\TransferException;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\Form\FormError;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PropertyInfo\Extractor\ReflectionExtractor;
use Symfony\Component\Security\Core\Exception\AccessDeniedException;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\ArrayDenormalizer;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;

/**
 * @Route("/backoffice/mosque")
 */
class MosqueController extends Controller
{

    /**
     * @Route(name="mosque_index")
     */
    public function indexAction(Request $request, EntityManagerInterface $em)
    {
        /**
         * @var User $user
         */
        $user = $this->getUser();
        $mosqueRepository = $em->getRepository("AppBundle:Mosque");
        $nbByStatus = [];
        $isAdmin = $this->isGranted("ROLE_ADMIN");
        if ($isAdmin) {
            $nbByStatus = $mosqueRepository->getNumberByStatus();
        }

        $form = $this->createForm(MosqueSearchType::class, null, ['method' => 'GET']);
        $form->handleRequest($request);

        $filter = array_merge($request->query->all(), (array)$form->getData());
        $qb = $mosqueRepository->search($user, $filter, $isAdmin);

        $paginator = $this->get('knp_paginator');
        $mosques = $paginator->paginate($qb, $request->query->getInt('page', 1), 10);

        $result = [
            "form" => $form->createView(),
            "mosques" => $mosques,
            "nbByStatus" => $nbByStatus,
            "languages" => $this->getParameter('languages')
        ];

        return $this->render('mosque/index.html.twig', $result);
    }


    /**
     * @Route("/ajax-search", name="mosque_search_calendar")
     * @Method("GET")
     * @param Request $request
     *
     * @return JsonResponse
     */
    public function searchCalendarAction(Request $request, EntityManagerInterface $em)
    {
        $query = $request->query->get('query');
        $result = $em->getRepository("AppBundle:Mosque")->searchMosquesWithCalendar($query);
        return new JsonResponse($result);
    }

    /**
     * Restet Sync flag
     * This is useful for raspberry env
     * @Route("/sync/reset/{id}", name="mosque_reset_sync")
     */
    public function resetSyncAction(Mosque $mosque)
    {
        $em = $this->getDoctrine()->getManager();
        $mosque->setSynchronized(false);
        $em->flush();

        return $this->redirectToRoute('mosque', ['slug' => $mosque->getSlug()]);
    }

    /**
     * Sync mosque data
     * This is useful for raspberry env
     * @Route("/sync/{id}", name="mosque_sync")
     */
    public function syncAction(Request $request, Client $client, Mosque $mosque)
    {
        $form = $this->createForm(MosqueSyncType::class);
        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $em = $this->getDoctrine()->getManager();

            if ($request->request->has('later')) {
                $mosque->setSynchronized(true);
            }

            if ($request->request->has('validate')) {
                try {
                    $res = $client->get(sprintf("mosque/%s", $form->getData()['id']));
                    $normalizer = new ObjectNormalizer(null, null, null, new ReflectionExtractor());
                    $serializer = new Serializer([new DateTimeNormalizer(), new ArrayDenormalizer(), $normalizer],
                        [new JsonEncoder()]);
                    $serializer->deserialize($res->getBody()->getContents(), Mosque::class, 'json',
                        ['object_to_populate' => $mosque]);
                    $mosque->setSynchronized(true);
                } catch (ConnectException $e) {
                    $this->addFlash("danger", "mosqueScreen.noInternetConnection");
                } catch (TransferException $e) {
                    $this->addFlash("danger", "mosqueScreen.noMosqueFound");
                } catch (\Exception $e) {
                    $this->addFlash("danger", "mosqueScreen.otherPb");
                }
            }

            $em->flush();
        }

        return $this->redirectToRoute('mosque', ['slug' => $mosque->getSlug()]);
    }

    /**
     * @Route("/create", name="mosque_create")
     * @throws GooglePositionException
     */
    public function createAction(Request $request)
    {
        $mosque = new Mosque();
        $form = $this->createForm(MosqueType::class, $mosque);

        try {
            $form->handleRequest($request);
        } catch (GooglePositionException $exc) {
            $form->addError(new FormError($this->get("translator")->trans("form.configure.geocode_error", [
                "%address%" => $mosque->getLocalisation()
            ])));
        }

        if ($form->isSubmitted() && $form->isValid()) {
            $em = $this->getDoctrine()->getManager();
            $mosque->setUser($this->getUser());
            $hijriAdjutment = $em->getRepository('AppBundle:Parameters')->findOneBy(['key' => 'hijri_adjustment']);
            $mosque->getConfiguration()->setHijriAdjustment((int)$hijriAdjutment->getValue());
            $em->persist($mosque);
            $em->flush();

            // send mail if mosque
            if ($mosque->isMosque()) {
                $this->get("app.mail_service")->mosqueCreated($mosque);
            }

            $this->addFlash('success', "form.create.success");
            return $this->redirectToRoute('mosque_index');
        }


        return $this->render('mosque/create.html.twig', [
            'form' => $form->createView(),
            "google_api_key" => $this->getParameter('google_api_key')
        ]);
    }

    /**
     * @Route("/edit/{id}", name="mosque_edit")
     */
    public function editAction(Request $request, Mosque $mosque)
    {

        $user = $this->getUser();
        if (!$this->isGranted("ROLE_ADMIN") && ($user !== $mosque->getUser() || !$mosque->isValidated())) {
            throw new AccessDeniedException();
        }

        $form = $this->createForm(MosqueType::class, $mosque);

        try {
            $form->handleRequest($request);
        } catch (GooglePositionException $exc) {
            $form->addError(new FormError($this->get("translator")->trans("form.configure.geocode_error", [
                "%address%" => $mosque->getLocalisation()
            ])));
        }

        if ($form->isSubmitted() && $form->isValid()) {
            $em = $this->getDoctrine()->getManager();
            $em->flush();
            $this->addFlash('success', "form.edit.success");

            return $this->redirectToRoute('mosque_index');
        }
        return $this->render('mosque/edit.html.twig', [
            'mosque' => $mosque,
            'form' => $form->createView(),
            "google_api_key" => $this->getParameter('google_api_key')
        ]);
    }

    /**
     * @Route("/delete/{id}", name="mosque_delete")
     */
    public function deleteAction(Mosque $mosque)
    {
        $user = $this->getUser();
        if (!$this->isGranted("ROLE_ADMIN") && ($user !== $mosque->getUser() || !$mosque->isNew())) {
            throw new AccessDeniedException;
        }

        $em = $this->getDoctrine()->getManager();
        $em->remove($mosque);
        $em->flush();
        $this->addFlash('success', "form.delete.success");
        return $this->redirectToRoute('mosque_index');
    }

    /**
     * Force refresh page by updating updated_at
     * @Route("/refresh/{id}", name="mosque_refresh")
     */
    public function refreshAction(Mosque $mosque)
    {
        $em = $this->getDoctrine()->getManager();
        $mosque->setUpdated(new \Datetime());
        $em->flush();
        return new Response();
    }

    /**
     * @Route("/{id}/configure", name="mosque_configure")
     */
    public function configureAction(Request $request, Mosque $mosque)
    {

        $user = $this->getUser();
        if (!$this->isGranted("ROLE_ADMIN") && $user !== $mosque->getUser()) {
            throw new AccessDeniedException;
        }
        $em = $this->getDoctrine()->getManager();

        $configuration = $mosque->getConfiguration();

        $form = $this->createForm(ConfigurationType::class, $configuration);

        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $em->flush();
            return $this->redirectToRoute('mosque', [
                'slug' => $mosque->getSlug()
            ]);
        }

        return $this->render('mosque/configure.html.twig', [
            'months' => Calendar::MONTHS,
            'mosque' => $mosque,
            'form' => $form->createView()
        ]);
    }

    /**
     * @Route("/qrcode/{id}", name="mosque_qr_code")
     */
    public function qrCodeAction(Mosque $mosque)
    {
        return $this->render('mosque/qrcode.html.twig', [
            'mosque' => $mosque
        ]);
    }

    /**
     * @Route("/copy-conf/mosque/{currentMosque}/from/{selectedMosque}", name="copy_conf")
     * @return Response
     */
    public function copyConfAction(Mosque $currentMosque, Mosque $selectedMosque, EntityManagerInterface $em)
    {
        $selectedConf = clone $selectedMosque->getConf();
        $selectedConf->setId(null);
        $selectedConf->setBackgroundMotif("1");
        $currentMosque->setConfiguration($selectedConf);
        $em->persist($currentMosque);
        $em->flush();

        return $this->redirectToRoute("mosque_configure", [
            'id' => $currentMosque->getId()
        ]);
    }
}
